import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const flowDesignerPath = path.join(root, 'src/components/flow-designer/FlowDesigner.tsx');
const metadataPath = path.join(root, 'src/components/flow-designer/onboardingMetadata.json');
const voiceClipsPath = path.join(root, 'src/components/flow-designer/voiceClips.ts');
const beatsDir = path.join(root, 'src/components/flow-designer/beats');

function literalValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isObjectLiteralExpression(node)) return objectValue(node);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literalValue);
  throw new Error(`Unsupported literal: ${ts.SyntaxKind[node.kind]}`);
}

function propertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  throw new Error(`Unsupported property name: ${ts.SyntaxKind[name.kind]}`);
}

function objectValue(node) {
  const out = {};
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) {
      throw new Error(`Unsupported object member: ${ts.SyntaxKind[prop.kind]}`);
    }
    out[propertyName(prop.name)] = literalValue(prop.initializer);
  }
  return out;
}

function findBaseBeats(sourceFile) {
  let beatsArray = null;

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'BASE_BEATS' &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      beatsArray = node.initializer;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!beatsArray) {
    throw new Error(`Could not find BASE_BEATS in ${flowDesignerPath}`);
  }

  return beatsArray.elements.map(literalValue);
}

function sortedElements(meta) {
  return [...(meta?.elements ?? [])].sort((a, b) => a.order - b.order);
}

function bubbleLines(meta) {
  return (meta?.narration ?? []).filter((seg) => seg.bubble != null && seg.say).map((seg) => seg.say);
}

function metadataPropsForBeat(type, meta) {
  if (!meta) return {};

  const bubbles = bubbleLines(meta);
  const elements = sortedElements(meta);

  switch (type) {
    case 'profile-beat':
      return {
        greeting: meta.opener ?? '',
        askAge: elements.find((element) => element.elementId === 'age')?.line ?? elements[0]?.line ?? '',
        askGender:
          elements.find((element) => element.elementId === 'gender')?.line ?? elements[1]?.line ?? '',
      };
    case 'advanced-capture':
      return {
        coachLine: meta.opener ?? '',
        closeCoachLine: meta.closeBubble ?? bubbles[1] ?? '',
      };
    case 'advanced-frequency':
      return {
        coachLine: meta.opener ?? '',
        coachLine2: meta.secondBubble ?? bubbles[1] ?? '',
        confirmCoachLine: meta.confirmBubble ?? bubbles[bubbles.length - 1] ?? '',
      };
    case 'into-app':
      return {
        coachLine: meta.opener ?? '',
        buttonLabel: meta.buttonLabel ?? 'Approve and start',
      };
    case 'state-check':
    case 'morning-checkin-setup':
    case 'reflection-card':
    case 'habit-schedule':
      return {
        coachLine: meta.opener ?? '',
        coachLine2: meta.secondBubble ?? bubbles[1] ?? '',
      };
    case 'mic-permission':
    case 'path-selection':
    case 'category-grid':
    case 'goals-list':
    case 'habit-picker':
    case 'custom-entry':
    case 'weekly-projection':
      return { coachLine: meta.opener ?? '' };
    default:
      return {};
  }
}

function voiceClipMap(source) {
  const map = new Map();
  const pairRe = /\[\s*'((?:\\'|[^'])*)'\s*,\s*'((?:\\'|[^'])*)'\s*\]/g;
  for (const match of source.matchAll(pairRe)) {
    const text = match[1].replaceAll("\\'", "'");
    const src = match[2].replaceAll("\\'", "'");
    map.set(text.trim(), src);
  }
  return map;
}

function stripExt(name) {
  return name.replace(/\.[^.]+$/, '');
}

const [flowDesignerSource, metadataSource, voiceClipsSource, beatFiles] = await Promise.all([
  readFile(flowDesignerPath, 'utf8'),
  readFile(metadataPath, 'utf8'),
  readFile(voiceClipsPath, 'utf8'),
  readdir(beatsDir),
]);

const flowSourceFile = ts.createSourceFile(
  flowDesignerPath,
  flowDesignerSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const baseBeats = findBaseBeats(flowSourceFile);
const metadata = JSON.parse(metadataSource);
const metadataByScreenId = new Map(metadata.beats.map((beat) => [beat.screenId, beat]));
const textToClip = voiceClipMap(voiceClipsSource);

const registryTypes = new Set();
for (const file of beatFiles) {
  if (!file.endsWith('.tsx') || file.startsWith('_')) continue;
  const source = await readFile(path.join(beatsDir, file), 'utf8');
  const match = source.match(/type:\s*'([^']+)'/);
  if (match) registryTypes.add(match[1]);
}

const problems = [];

for (const beat of baseBeats) {
  const label = beat.screenId ?? beat.id;
  const meta = beat.screenId ? metadataByScreenId.get(beat.screenId) : null;

  if (!registryTypes.has(beat.type)) {
    problems.push(`${label}: beat type "${beat.type}" is not registered in BEAT_DEFS`);
  }

  if (!beat.screenId) continue;
  if (!meta) {
    problems.push(`${label}: missing metadata entry`);
    continue;
  }

  const expectedProps = metadataPropsForBeat(beat.type, meta);
  for (const [key, expected] of Object.entries(expectedProps)) {
    const actual = beat.props?.[key];
    if (actual != null && actual !== expected) {
      problems.push(`${label}: BEATS props.${key} disagrees with metadata`);
    }
  }

  const bubbleCount = [
    expectedProps.coachLine,
    expectedProps.coachLine2,
    expectedProps.closeCoachLine,
    expectedProps.confirmCoachLine,
  ].filter(Boolean).length;
  if (bubbleCount > 1 && (!Array.isArray(meta.narration) || meta.narration.length === 0)) {
    problems.push(`${label}: multi-bubble beat is missing a narration array`);
  }

  if (meta.engine !== 'MP3' || meta.variable) continue;

  const coverageTexts = new Set(
    [
      expectedProps.greeting,
      expectedProps.askAge,
      expectedProps.askGender,
      expectedProps.coachLine,
      expectedProps.coachLine2,
      expectedProps.closeCoachLine,
      expectedProps.confirmCoachLine,
      ...((meta.narration ?? []).map((seg) => seg.say)),
    ].filter((line) => typeof line === 'string' && line.trim()),
  );

  for (const line of coverageTexts) {
    const seg = (meta.narration ?? []).find((entry) => entry.say === line);
    const covered = Boolean(seg?.audioSrc || seg?.clip || textToClip.has(line.trim()));
    if (!covered) {
      problems.push(`${label}: recorded line has no clip coverage -> "${line}"`);
    }
  }
}

if (problems.length) {
  console.error('Render consistency check failed.\n');
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log(`Render consistency check passed for ${baseBeats.length} beats.`);
