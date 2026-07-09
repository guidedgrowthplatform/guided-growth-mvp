# Azure QA fleet migration — status recheck 2026-07-09

**Date:** 2026-07-09 21:15 IDT  
**Scope:** read-only verification of live state post-migration  
**Source docs:** iota-azure-deploy.md, azure-swap-plan.md, qa-cloud-fleet-options.md, human-qa-fleet-connection.md

---

## 1. WHAT CHANGED

**Environment moved from OpenAI to Azure:**
- `LLM_PROVIDER=azure` now set in Vercel project env (target: production, preview)
- Five new Azure env vars present and attached: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_ONBOARDING_DEPLOYMENT`, `AZURE_OPENAI_DEFAULT_DEPLOYMENT`
- Vercel deployment `dpl_DZzbUfPGyZnawpMwtKjjZB8HYtuq` rebuilt and aliased to `gg-qa-iota.vercel.app`
- Coach turn test executed live (2026-07-09 ~19:00 IDT) — HTTP 200, streaming SSE, real text response, `latency_ms: 1344`

---

## 2. IS IT LIVE? YES — BUT INCOMPLETE

**The deployment is currently live and serving requests:**
- `gg-qa-iota.vercel.app` alias resolves and returns HTTP 200 on `/api/llm` coach-turn calls
- Azure resource `gg-qa-openai` (eastus2, resource group `gg-qa-fleet`) is reachable
- Current active models on the resource: `gpt-5-mini` (v2025-08-07), `gpt-5.4-mini` (v2026-03-17), both at 50 TPM capacity

**Critical caveat — models are not production-ready:**
- `gpt-5-mini` and `gpt-5.4-mini` are reasoning-tier models that **reject the `temperature` parameter**
- The app's `api/llm/openai-responses.ts:66` currently sends `temperature: opts.temperature ?? 0.6` unconditionally
- This means every non-onboarding coach turn will fail silently or return 400 if the model tries to parse it
- The iota-azure-deploy test avoided this by testing onboarding (which may use a different path or has temperature gated)

**API version is too old:**
- Existing env var `AZURE_OPENAI_API_VERSION=2025-01-01-preview` cannot reach Responses API
- Must be `2025-03-01-preview` or `preview` (v1 surface recommended)
- This blocks Responses API calls if the code tries to use anything beyond Chat Completions

---

## 3. PROBE RESULT

Not run directly (credentials not available in this session). Verdict based on:
- **Vercel API call** (iota-azure-deploy.md, line 21-29): deployment `readyState: READY`, env vars confirmed attached to preview target, alias repoint succeeded
- **Coach turn test** (line 32-45): one real turn via POST `/api/llm` with mode=chat returned 200 SSE stream with coach text, metrics show `latency_ms: 1344`, `total_tokens: 3217`, `tool_rounds: 0`, no error event
- **Caveat:** test was minimal (one turn, no tool-calling, no multi-turn chaining tested, no temperature-using models tested)

---

## 4. TOP BLOCKERS BEFORE PRODUCTION

**Immediate (blocks real coach use):**

1. **Temperature parameter guard:** app code needs the conditional check from `azure-swap-plan.md` section 4, lines 162-165. Add `NO_TEMPERATURE_MODELS` allowlist; condition the send on the model name. Without this, every non-onboarding turn will 400.

2. **API version bump:** update `AZURE_OPENAI_API_VERSION` from `2025-01-01-preview` to `preview` (v1 surface is recommended in the plan and was validated live). Do this before writing code so Responses API calls work.

3. **New model deployments:** the plan recommends creating fresh `gpt-4o-prod` and `gpt-4o-mini-prod` deployments (not reusing the QA fleet's gpt-5-mini/gpt-5.4-mini). These have not been created. Command ready in `azure-swap-plan.md` section 7, step 2. Capacity: 50-100 TPM-units is generous headroom for current user volume (139 users/90d per YAIR.md). Can be done via `az` CLI (already authed).

4. **Model references in environment:** once new deployments exist, update `AZURE_OPENAI_ONBOARDING_DEPLOYMENT` and `AZURE_OPENAI_DEFAULT_DEPLOYMENT` env vars in Vercel to point to `gpt-4o-prod` and `gpt-4o-mini-prod`.

**Secondary (QA + risk mitigation):**

- Smoke test on the new gpt-4o/gpt-4o-mini models once deployed (plan calls this out, section 8, "not tested yet")
- Verify Responses API chaining (multi-turn) and tool-calling work end-to-end (validated live against gpt-5, but gpt-4o family is same code path)
- Re-verify that app's existing tool-call + context shapes work (the plan validated the request body shape against gpt-5-mini, should be identical for gpt-4o family)

---

## 5. WHAT DOES NOT NEED RE-DOING

- The deploy itself is sound — repointed the alias correctly, env vars are present
- Vercel project config is correct (no trailing-slash routing issues, correct VERCEL_ORG_ID/VERCEL_PROJECT_ID)
- The Azure resource quota and availability for gpt-4o/gpt-4o-mini is confirmed (catalog + quota both checked in plan, 450K/2000K TPM headroom)

---

## 6. ONE-LINE VERDICT

**LIVE but incomplete:** gg-qa-iota deploys and serves Azure coach turns, but models are reasoning-tier (reject temperature), API version is too old for Responses API, and production-ready gpt-4o/gpt-4o-mini models haven't been deployed yet; blocker = temperature guard in code + model deployments + env-var update, all ready to execute per the plan.
