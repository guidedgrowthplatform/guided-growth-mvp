/**
 * GET /api/qa/users
 *
 * Lists the QA test accounts (emails matching qa-onboarding-*@guidedgrowth.test)
 * so the /onboarding/qa control screen can build its dropdown from the REAL
 * Supabase accounts instead of a hardcoded list. Add or remove a QA account in
 * Supabase and the dropdown follows, no code edit.
 *
 * Returns each account's derived name and whether it has onboarded (so QA can
 * see at a glance who already has data). Only ever returns qa-onboarding-*
 * accounts, never real users, so listing it is not a leak.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { handlePreflight } from '../_lib/auth.js';
import { refuseIfProd } from '../_lib/dbEnv.js';

const QA_EMAIL_PATTERN = /^qa-(onboarding|weekly)-[a-z0-9-]+@guidedgrowth\.test$/;

function nameFromEmail(email: string): string {
  const slug = email.replace(/^qa-(onboarding|weekly)-/, '').replace(/@guidedgrowth\.test$/, '');
  return slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : email;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (refuseIfProd(res)) return;

  try {
    // List auth users (a few pages is plenty for test accounts) and keep only QA.
    const qa: { id: string; email: string }[] = [];
    for (let page = 1; page <= 5; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data) break;
      for (const u of data.users) {
        const email = (u.email ?? '').toLowerCase();
        if (QA_EMAIL_PATTERN.test(email)) qa.push({ id: u.id, email });
      }
      if (data.users.length < 200) break;
    }

    // Mark who has onboarded (onboarding_path is set on completion). Decoration
    // only: a fresh DB or a stale pool credential must not kill the list.
    let onboardedIds: Set<string> | null = null;
    if (qa.length) {
      try {
        const { rows } = await pool.query<{ id: string }>(
          `SELECT id FROM profiles WHERE id = ANY($1::uuid[]) AND onboarding_path IS NOT NULL`,
          [qa.map((u) => u.id)],
        );
        onboardedIds = new Set(rows.map((r) => r.id));
      } catch (err) {
        console.error('[qa/users] onboarded enrichment failed, returning bare list', err);
      }
    }

    const users = qa
      .map((u) => ({
        email: u.email,
        name: nameFromEmail(u.email),
        ...(onboardedIds ? { onboarded: onboardedIds.has(u.id) } : {}),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({ users });
  } catch (err) {
    console.error('[qa/users] failed', err);
    return res.status(500).json({ error: 'Failed to list QA users' });
  }
}
