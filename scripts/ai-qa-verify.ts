#!/usr/bin/env node
/**
 * ai-qa-verify.ts
 *
 * Walks ai-qa/**\/*.md, parses YAML-style frontmatter, and asserts:
 *   1. primary.file exists on disk (relative to repo root)
 *   2. primary.symbol appears in that file (as export const|function|class
 *      or as a const/function/identifier) — unless it's a parenthesized
 *      annotation like "(internal const)", "(default handler)", etc.
 *   3. each related[].file/.symbol passes the same check
 *   4. last_verified is not older than 60 days (warning, not error)
 *
 * Run: `npx tsx scripts/ai-qa-verify.ts`
 * Exit code 0 = clean, 1 = at least one mismatch.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const AI_QA_ROOT = resolve(REPO_ROOT, 'ai-qa');
const STALE_DAYS = 60;
const ANNOTATION_RE = /^\(.+\)$/; // skip symbol check when annotated, e.g. "(internal const)"

interface Reference {
  file: string;
  symbol?: string;
}

interface Frontmatter {
  domain?: string;
  title?: string;
  primary?: Reference;
  related?: Reference[];
  last_verified?: string;
}

interface Finding {
  level: 'error' | 'warn';
  mdPath: string;
  message: string;
}

const findings: Finding[] = [];

function listMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...listMarkdownFiles(full));
    else if (name.endsWith('.md')) out.push(full);
  }
  return out;
}

function parseFrontmatter(raw: string): Frontmatter | null {
  if (!raw.startsWith('---')) return null;
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return null;
  const body = raw.slice(4, end);

  const fm: Frontmatter = {};
  const lines = body.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (!m) {
      i++;
      continue;
    }
    const [, key, valueRaw] = m;
    const value = valueRaw.trim();

    if (key === 'primary' && value === '') {
      // Nested object on following indented lines
      const obj: Reference = { file: '' };
      i++;
      while (i < lines.length && /^\s{2,}\S/.test(lines[i])) {
        const sub = lines[i].match(/^\s+([a-zA-Z_]+):\s*(.*)$/);
        if (sub) {
          if (sub[1] === 'file') obj.file = sub[2].trim();
          else if (sub[1] === 'symbol') obj.symbol = sub[2].trim();
        }
        i++;
      }
      fm.primary = obj;
      continue;
    }

    if (key === 'related' && value === '') {
      const arr: Reference[] = [];
      i++;
      while (i < lines.length && /^\s+-\s/.test(lines[i])) {
        // start of a list item
        const cur: Reference = { file: '' };
        const firstM = lines[i].match(/^\s+-\s+([a-zA-Z_]+):\s*(.*)$/);
        if (firstM) {
          if (firstM[1] === 'file') cur.file = firstM[2].trim();
          else if (firstM[1] === 'symbol') cur.symbol = firstM[2].trim();
        }
        i++;
        while (i < lines.length && /^\s{4,}[a-zA-Z_]+:/.test(lines[i])) {
          const sub = lines[i].match(/^\s+([a-zA-Z_]+):\s*(.*)$/);
          if (sub) {
            if (sub[1] === 'file') cur.file = sub[2].trim();
            else if (sub[1] === 'symbol') cur.symbol = sub[2].trim();
          }
          i++;
        }
        arr.push(cur);
      }
      fm.related = arr;
      continue;
    }

    if (key === 'last_verified') fm.last_verified = value;
    else if (key === 'domain') fm.domain = value;
    else if (key === 'title') fm.title = value;
    i++;
  }

  return fm;
}

function checkReference(mdPath: string, ref: Reference, label: string): void {
  if (!ref.file) {
    findings.push({ level: 'error', mdPath, message: `${label}: missing file` });
    return;
  }
  const fileAbs = resolve(REPO_ROOT, ref.file);
  try {
    statSync(fileAbs);
  } catch {
    findings.push({
      level: 'error',
      mdPath,
      message: `${label}: file does not exist → ${ref.file}`,
    });
    return;
  }

  // Symbol check
  if (!ref.symbol) return; // optional
  const sym = ref.symbol.trim();
  if (ANNOTATION_RE.test(sym)) return; // annotated as non-symbol; skip
  // Strip suffix annotations like " (internal const)" / " (internal function)"
  const cleanSym = sym.replace(/\s*\([^)]*\)\s*$/, '');
  if (!cleanSym) return;

  const content = readFileSync(fileAbs, 'utf8');
  // Generous symbol search: matches export const NAME, export function NAME, export class NAME,
  // export interface NAME, export type NAME, const NAME, function NAME,
  // or the symbol appearing as a key in CHECKIN_TOOLS / ONBOARDING_TOOLS arrays (`name: 'NAME'`).
  const esc = cleanSym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(
      `\\bexport\\s+(?:const|function|class|interface|type|async\\s+function)\\s+${esc}\\b`,
    ),
    new RegExp(`\\b(?:const|function|class|interface|type)\\s+${esc}\\b`),
    new RegExp(`\\bname:\\s*['"\`]${esc}['"\`]`),
    new RegExp(`\\bexport\\s*\\{[^}]*\\b${esc}\\b[^}]*\\}`),
    new RegExp(`\\bexport\\s+default\\s+${esc}\\b`),
  ];
  const ok = patterns.some((p) => p.test(content));
  if (!ok) {
    findings.push({
      level: 'error',
      mdPath,
      message: `${label}: symbol "${cleanSym}" not found in ${ref.file}`,
    });
  }
}

function checkStaleness(mdPath: string, fm: Frontmatter): void {
  if (!fm.last_verified) {
    findings.push({ level: 'warn', mdPath, message: 'frontmatter missing last_verified' });
    return;
  }
  const date = new Date(fm.last_verified);
  if (isNaN(date.getTime())) {
    findings.push({
      level: 'warn',
      mdPath,
      message: `last_verified is not a valid date: "${fm.last_verified}"`,
    });
    return;
  }
  const ageDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (ageDays > STALE_DAYS) {
    findings.push({
      level: 'warn',
      mdPath,
      message: `last_verified is ${ageDays} days old (threshold: ${STALE_DAYS}). Re-audit recommended.`,
    });
  }
}

function main(): number {
  try {
    statSync(AI_QA_ROOT);
  } catch {
    console.error(`ai-qa/ folder not found at ${AI_QA_ROOT}`);
    return 1;
  }

  const mds = listMarkdownFiles(AI_QA_ROOT).filter((p) => !p.endsWith('README.md'));
  console.log(`ai-qa-verify: scanning ${mds.length} markdown files…\n`);

  for (const mdAbs of mds) {
    const mdRel = relative(REPO_ROOT, mdAbs);
    const raw = readFileSync(mdAbs, 'utf8');
    const fm = parseFrontmatter(raw);
    if (!fm) {
      findings.push({
        level: 'warn',
        mdPath: mdRel,
        message: 'missing or unparseable frontmatter',
      });
      continue;
    }

    checkStaleness(mdRel, fm);

    if (fm.primary) checkReference(mdRel, fm.primary, 'primary');
    else findings.push({ level: 'warn', mdPath: mdRel, message: 'frontmatter missing primary' });

    if (fm.related) {
      fm.related.forEach((ref, idx) => {
        checkReference(mdRel, ref, `related[${idx}]`);
      });
    }
  }

  const errors = findings.filter((f) => f.level === 'error');
  const warns = findings.filter((f) => f.level === 'warn');

  if (errors.length === 0 && warns.length === 0) {
    console.log('✓ all references valid, no stale frontmatter.');
    return 0;
  }

  if (errors.length > 0) {
    console.log(`\n${errors.length} ERROR(S):`);
    for (const f of errors) console.log(`  [ERROR] ${f.mdPath} — ${f.message}`);
  }
  if (warns.length > 0) {
    console.log(`\n${warns.length} WARNING(S):`);
    for (const f of warns) console.log(`  [warn]  ${f.mdPath} — ${f.message}`);
  }

  return errors.length > 0 ? 1 : 0;
}

process.exit(main());
