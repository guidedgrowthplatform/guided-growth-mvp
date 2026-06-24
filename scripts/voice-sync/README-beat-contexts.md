# Beat-context sync

One-way pipeline: **Supabase is the editable source** for onboarding beat copy
(the `context` and `opener` fields). A sync script writes a generated JSON file
that `beatContexts.ts` merges at startup.

`allowedTools` is **never** stored in Supabase. It is code-owned in
`beatContexts.ts` and stays there permanently.

---

## Tables (migration 052)

| Table                | Purpose                                                                     |
| -------------------- | --------------------------------------------------------------------------- |
| `beat_contexts`      | Per-beat `context` + `opener`, `version`, `content_hash`. PK = `screen_id`. |
| `onboarding_globals` | Single row (`id = 'default'`): `global_context` + `bundle_version`.         |

RLS is ON with no policies -- the service role bypasses (same pattern as
`screen_contexts` from migration 016). No user data is stored here.

---

## Scripts

### 1. Seed once

```bash
cd scripts/voice-sync
source .venv/bin/activate

# Push the hand-authored beatContexts.ts content into Supabase to bootstrap.
python seed_beat_contexts.py

# Dry-run first to preview the diff:
python seed_beat_contexts.py --dry-run

# One beat only (fast iteration):
python seed_beat_contexts.py --screen-id ONBOARD-BEGINNER-03
```

Run this **once** after the migration runs, or any time the hand-authored
source is changed and needs to be promoted to Supabase as the new baseline.
It is idempotent: re-running with no source changes makes zero DB writes.

### 2. Sync on a schedule (or on-demand)

```bash
python sync_beat_contexts.py
```

Reads `beat_contexts` + `onboarding_globals` from Supabase and writes:

```
api/_lib/llm/onboarding/beatContexts.generated.json
```

Idempotent: only rewrites the file when Supabase content has actually changed.
Safe to run as a GitHub Actions cron.

```bash
# Dry-run (logs diff, no file write):
python sync_beat_contexts.py --dry-run

# Inspect one beat from Supabase:
python sync_beat_contexts.py --screen-id ONBOARD-BEGINNER-03
```

---

## Generated file shape

```json
{
  "_comment": "Auto-generated ...",
  "_generatedAt": "2026-06-24T12:00:00Z",
  "bundleVersion": 2,
  "global": "...",
  "beats": {
    "ONBOARD-01--FORM": {
      "context": "...",
      "opener": "...",
      "version": 1,
      "contentHash": "a1b2c3d4"
    }
  }
}
```

`opener` is omitted for beats that have no scripted line (e.g. `ONBOARD-AUTH--FORM`).

---

## How beatContexts.ts merges it (do NOT apply -- see comment in beatContexts.ts)

Add the snippet below to `beatContexts.ts` to wire the merge. The PR that
does this merge is a separate change kept in the lane that owns `src/` and
`api/`. The snippet is provided here for reference only.

```ts
// At the top of beatContexts.ts, after the static BEAT_CONTEXTS definition:
import { readFileSync } from 'fs';
import { resolve } from 'path';

function _loadGeneratedOverrides(): void {
  try {
    const p = resolve(__dirname, 'beatContexts.generated.json');
    const raw = JSON.parse(readFileSync(p, 'utf-8'));
    const beats: Record<string, { context: string; opener?: string; version: number }> =
      raw.beats ?? {};
    for (const [screenId, override] of Object.entries(beats)) {
      if (BEAT_CONTEXTS[screenId]) {
        BEAT_CONTEXTS[screenId] = {
          ...BEAT_CONTEXTS[screenId], // keep allowedTools from code
          context: override.context,
          ...(override.opener !== undefined ? { opener: override.opener } : {}),
        };
      }
    }
    // Optionally update the bundle version for telemetry:
    // (BEAT_CONTEXT_VERSION as any) = raw.bundleVersion ?? BEAT_CONTEXT_VERSION;
  } catch {
    // Generated file absent (dev without sync, or first deploy) -- use hand-authored defaults.
  }
}

_loadGeneratedOverrides();
```

Key properties of the merge:

- `allowedTools` is preserved from the static definition (never in the generated file).
- Unknown `screen_id` keys in the generated file are silently ignored.
- Missing generated file is a no-op (safe on first deploy).
- `opener` absence in the generated row leaves the hand-authored opener in place.

---

## Env

Same env as `seed_contexts.py`:

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

No Google Sheets credentials needed -- this pipeline is Supabase-only.

---

## Content hash

Both scripts use the same FNV-1a algorithm as `getBeatContextMeta()` in
`beatContexts.ts`:

```
hash = fnv1a(context + "\n" + (opener ?? ""))
```

This lets you verify that what is in Supabase matches what was generated from
a given version of the TS source.
