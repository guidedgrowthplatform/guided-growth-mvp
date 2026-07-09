# QA TTS Stub — deployment verification (2026-07-10)

## Question
Is the QA TTS stub (`VITE_QA_STUB_TTS`) actually active on the deployed `gg-qa` app, so the
QA swarm replays a canned clip instead of hitting live metered Cartesia?

## Chain checked

### 1. MR !533 state (GitLab API)
`GET https://gitlab.guidedgrowthapp.com/api/v4/projects/guidedgrowth-group%2Fguided-growth-mvp/merge_requests/533`

```
"title": "Draft: Re-land VITE_QA_STUB_TTS cost guard on current main",
"state": "opened",
"draft": true,
"work_in_progress": true,
"merged_by": null,
"merged_at": null,
"target_branch": "main",
"source_branch": "fix/qa-stub-tts-relanded",
"merge_status": "can_be_merged",
"detailed_merge_status": "draft_status",
"pipeline": { "status": "success" }
```

**!533 is still a draft, NOT merged to main.** Pipeline is green (14/14 vitest passing, tsc clean)
but that only proves the code works on its branch, not that it's in the deployed app.

The MR's own description confirms the second half of the chain was never done either:
> "This session had no Vercel auth to do [set VITE_QA_STUB_TTS on gg-qa + redeploy]."

### 2. Deployed bundle inspection (no live Cartesia call made)

Fetched `https://gg-qa-iota.vercel.app/` (HTTP 200), pulled the referenced main JS bundle:
`assets/index-D-VWiYEE.js` (941,523 bytes).

- `grep -c "VITE_QA_STUB_TTS" main_bundle.js` → **0 matches**. The build-time flag string is
  not inlined anywhere in the bundle (Vite inlines `import.meta.env.*` literals at build time —
  if the stub code were present and the flag true, the literal would show up; it doesn't even
  show up as a false-branch reference, meaning the stub code itself isn't in this build at all).
- `grep -o "cartesia-tts[a-zA-Z-]*"` → both `cartesia-tts` and `cartesia-tts-sse` endpoint
  strings ARE present (these are the pre-existing live-call endpoints, unchanged).
- Inspected the actual minified call site around the first `cartesia-tts` hit:
  ```js
  const i = await fetch(`${xw()}/api/cartesia-tts`, {
    method: "POST",
    headers: {...},
    body: JSON.stringify({ text: r, voice_id: o, ... }),
    signal: n.signal
  });
  ```
  This is a direct, unconditional fetch to the live Cartesia proxy endpoint. There is no
  `VITE_QA_STUB_TTS` branch, no canned-clip/local-stub code path visible around it.
- Listed all 98 chunk files referenced from the main bundle (dynamic-import manifest) — none
  are named after voice/tts/cartesia/coach/checkin, confirming `tts-service.ts` and
  `cartesiaVoice.ts` are bundled directly into the main chunk (not lazy-split), so the main
  bundle is the correct and complete place to look. No separate stub chunk exists anywhere.

No preview deployment URL for the MR branch was available to check (no Vercel API auth in this
session) — only the production `gg-qa-iota.vercel.app` alias was checked, which is what the QA
swarm actually hits.

## Conclusion

Both required conditions fail:
1. Stub code is not merged to main (!533 still draft) → not in any build from main.
2. Confirmed empirically: the deployed `gg-qa-iota` bundle has zero trace of
   `VITE_QA_STUB_TTS` or a stub/canned-clip code path; the live `/api/cartesia-tts` fetch is
   unconditional.
3. Setting the env var on Vercel (which Yair just did) has no effect yet since the code that
   reads it was never built in, and per the MR's own test plan, no redeploy has been triggered
   for this purpose either.

**The QA swarm is NOT TTS-cost-safe right now.** Any swarm agent that reaches the coach chat or
check-in flow on `gg-qa-iota.vercel.app` will still make a real, metered Cartesia call.

## Missing steps (in order)
1. Merge !533 to `main` (currently draft — someone needs to un-draft it and get it merged).
2. Trigger a fresh Vercel build/deploy of the `gg-qa` project from `main` (post-merge) so the
   new code compiles in — Vite bakes `VITE_QA_STUB_TTS` in at build time, so the var Yair just
   set will not take effect until this new build happens.
3. Re-verify post-deploy: refetch the bundle, confirm the stub literal/branch is now present.
