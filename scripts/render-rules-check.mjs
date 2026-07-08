// Guard 3 of 3: RULES.
// Flow and beat rules are now part of the render contract. This check keeps
// the rules honest:
//   1. every rule has the expected shape
//   2. every "must" rule is enforced, or explicitly marked prose-only-accepted
//   3. every code rule's enforcedBy points at a real guard, package script, or
//      exported schema in beatsSource.ts

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const beatsSourcePath = path.join(root, 'src/components/flow-designer/beatsSource.ts');
const packagePath = path.join(root, 'package.json');
const ACCEPTED_PROSE_ONLY = 'prose-only-accepted';
const CONTEXT_ONLY_ENFORCERS = new Set([ACCEPTED_PROSE_ONLY, 'parity-walk']);
const SEVERITIES = new Set(['must', 'should']);

function literalValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) return -Number(node.operand.text);
  if (ts.isObjectLiteralExpression(node)) {
    const out = {};
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const key = ts.isStringLiteral(prop.name) || ts.isNumericLiteral(prop.name) ? prop.name.text : prop.name.getText();
      out[key] = literalValue(prop.initializer);
    }
    return out;
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literalValue);
  throw new Error(`Unsupported literal: ${ts.SyntaxKind[node.kind]}`);
}

function parseExportedValue(text, name) {
  const sf = ts.createSourceFile('beatsSource.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let value = null;
  (function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) {
      const init = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
      value = literalValue(init);
      return;
    }
    ts.forEachChild(node, visit);
  })(sf);
  if (value == null) throw new Error(`Could not find ${name} in beatsSource.ts`);
  return value;
}

function exportedSchemaNames(text) {
  const sf = ts.createSourceFile('beatsSource.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names = new Set();
  (function visit(node) {
    const exported =
      ts.canHaveModifiers(node) &&
      (ts.getModifiers(node) ?? []).some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword);
    if (
      exported &&
      (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
      ts.isIdentifier(node.name)
    ) {
      names.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  })(sf);
  return names;
}

async function exists(relPath) {
  try {
    await access(path.join(root, relPath));
    return true;
  } catch {
    return false;
  }
}

const src = await readFile(beatsSourcePath, 'utf8');
const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
const schemas = exportedSchemaNames(src);
const globalRules = parseExportedValue(src, 'GLOBAL_RULES');
const flows = parseExportedValue(src, 'FLOWS_SOURCE');
const beats = parseExportedValue(src, 'BEATS_SOURCE');
const problems = [];

async function resolvesEnforcer(enforcedBy) {
  if (!enforcedBy || typeof enforcedBy !== 'string') return false;
  if (enforcedBy.startsWith('schema:')) return schemas.has(enforcedBy.slice('schema:'.length));
  if (enforcedBy.startsWith('npm:')) return Boolean(pkg.scripts?.[enforcedBy.slice('npm:'.length)]);
  if (enforcedBy.startsWith('scripts/')) return exists(enforcedBy);
  if (enforcedBy.includes('/')) return exists(enforcedBy);
  return false;
}

async function checkRule(rule, label, bucket) {
  if (!rule || typeof rule !== 'object') {
    problems.push(`${label}: ${bucket} rule is not an object`);
    return;
  }
  if (!rule.id || typeof rule.id !== 'string') problems.push(`${label}: ${bucket} rule missing string id`);
  if (!rule.rule || typeof rule.rule !== 'string') problems.push(`${label}: ${bucket} rule ${rule.id ?? '(unknown)'} missing rule text`);
  if (!SEVERITIES.has(rule.severity)) problems.push(`${label}: ${bucket} rule ${rule.id ?? '(unknown)'} has invalid severity`);

  if (rule.severity === 'must' && rule.enforcedBy == null) {
    problems.push(`${label}: ${bucket} must-rule ${rule.id ?? '(unknown)'} has no enforcedBy and is not prose-only-accepted`);
  }

  if (bucket === 'code') {
    if (rule.enforcedBy == null) {
      problems.push(`${label}: code rule ${rule.id ?? '(unknown)'} must name a guard, test, schema, or package script`);
    } else if (CONTEXT_ONLY_ENFORCERS.has(rule.enforcedBy)) {
      problems.push(`${label}: code rule ${rule.id ?? '(unknown)'} uses context-only enforcer ${rule.enforcedBy}`);
    } else if (!(await resolvesEnforcer(rule.enforcedBy))) {
      problems.push(`${label}: code rule ${rule.id ?? '(unknown)'} enforcedBy "${rule.enforcedBy}" does not resolve`);
    }
  } else if (rule.enforcedBy != null && !CONTEXT_ONLY_ENFORCERS.has(rule.enforcedBy) && !(await resolvesEnforcer(rule.enforcedBy))) {
    problems.push(`${label}: context rule ${rule.id ?? '(unknown)'} enforcedBy "${rule.enforcedBy}" does not resolve`);
  }
}

async function checkRuleset(rules, label) {
  if (!rules || typeof rules !== 'object') {
    problems.push(`${label}: rules must be an object`);
    return;
  }
  for (const bucket of ['context', 'code']) {
    if (!Array.isArray(rules[bucket])) {
      problems.push(`${label}: rules.${bucket} must be an array`);
      continue;
    }
    const seen = new Set();
    for (const rule of rules[bucket]) {
      if (rule?.id) {
        if (seen.has(rule.id)) problems.push(`${label}: duplicate ${bucket} rule id ${rule.id}`);
        seen.add(rule.id);
      }
      await checkRule(rule, label, bucket);
    }
  }
}

await checkRuleset(globalRules, 'GLOBAL_RULES');
for (const flow of flows) {
  const label = `flow:${flow.id ?? '(unknown flow)'}`;
  if (!flow.id || typeof flow.id !== 'string') problems.push(`${label}: missing string id`);
  if (!flow.name || typeof flow.name !== 'string') problems.push(`${label}: missing string name`);
  if (!Array.isArray(flow.engines)) problems.push(`${label}: engines must be an array`);
  if (!flow.systemPrompt || typeof flow.systemPrompt !== 'string') problems.push(`${label}: missing string systemPrompt`);
  if (!flow.entry || typeof flow.entry !== 'string') problems.push(`${label}: missing string entry`);
  if (!flow.exit || typeof flow.exit !== 'string') problems.push(`${label}: missing string exit`);
  if (!Array.isArray(flow.tools)) problems.push(`${label}: tools must be an array`);
  if (!Array.isArray(flow.data)) problems.push(`${label}: data must be an array`);
  await checkRuleset(flow.flowRules, `${label}.flowRules`);

  const usesVapi = Array.isArray(flow.engines) && flow.engines.includes('Vapi');
  if (usesVapi && !flow.vapiAgent) {
    problems.push(`${label}: engines includes Vapi but vapiAgent is missing`);
  }
  if (!usesVapi && flow.vapiAgent) {
    problems.push(`${label}: vapiAgent is present but engines does not include Vapi`);
  }
  if (flow.vapiAgent) {
    const agent = flow.vapiAgent;
    for (const field of ['systemPrompt', 'firstMessage', 'model', 'voice', 'serverUrl', 'transcriber']) {
      if (!agent[field] || typeof agent[field] !== 'string') {
        problems.push(`${label}.vapiAgent: missing string ${field}`);
      }
    }
    if (!Array.isArray(agent.drivesBeats) || agent.drivesBeats.length === 0) {
      problems.push(`${label}.vapiAgent: drivesBeats must be a non-empty array`);
    }
    if (!Array.isArray(agent.tools) || agent.tools.length === 0) {
      problems.push(`${label}.vapiAgent: tools must be a non-empty array`);
    } else {
      for (const tool of agent.tools) {
        if (!tool?.name || typeof tool.name !== 'string') problems.push(`${label}.vapiAgent: tool missing name`);
        if (tool?.id == null || typeof tool.id !== 'string') problems.push(`${label}.vapiAgent: tool ${tool?.name ?? '(unknown)'} missing id`);
        if (!tool?.screen || typeof tool.screen !== 'string') problems.push(`${label}.vapiAgent: tool ${tool?.name ?? '(unknown)'} missing screen`);
      }
    }
  }
}
for (const beat of beats) {
  if (beat.rules !== undefined) await checkRuleset(beat.rules, beat.id ?? beat.screenId ?? '(unknown beat)');
}

if (problems.length) {
  console.error('Render RULES check failed.\n');
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}

const ruledBeats = beats.filter((beat) => beat.rules !== undefined).length;
console.log(`Render RULES check passed: ${flows.length} flow(s), ${ruledBeats} beat(s) with rules, global rules included.`);
