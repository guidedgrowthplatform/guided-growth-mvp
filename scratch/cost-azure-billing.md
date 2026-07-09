# QA Fleet LLM Cost Audit — Azure Billing Confirmation

**Date:** 2026-07-09  
**Scope:** Read-only cost-safety audit of gg-qa-iota LLM routing  
**Status:** COMPLETE with one open question on billing source

---

## Summary

**Primary finding: gg-qa-iota LLM cost is routed to Azure (not direct personal OpenAI billing).**

✓ The deployment has `LLM_PROVIDER=azure` confirmed live  
✓ All 5 `AZURE_OPENAI_*` env vars are attached  
✓ A test coach turn verified routing works end-to-end  
✓ Azure resource `gg-qa-openai` exists and is operational  
⚠ Billing source for the Azure resource (credits vs card) requires confirmation  
⚠ Fallback OpenAI key presence not verified; should be explicitly removed or documented

---

## Detailed findings

### 1. Live deployment confirms Azure routing ✓

**Source:** `iota-azure-deploy.md` (2026-07-09 18:58-19:02 IDT)

- Deployment `dpl_DZzbUfPGyZnawpMwtKjjZB8HYtuq` to Vercel (preview alias `gg-qa-iota.vercel.app`)
- Verified via Vercel API: `LLM_PROVIDER=azure` present with value `"azure"`, target includes `preview`
- All 5 `AZURE_OPENAI_*` vars attached to same target (`production, preview`)
- Live coach turn test: HTTP 200, streaming SSE response, real text back
- Proof standard met: env=azure + working turn; no personal OpenAI key error surfaced

**Risk assessment:** NONE on routing — the deployment is definitely pointed at Azure, not direct OpenAI.

---

### 2. Azure resource exists and is operational ✓

**Source:** `azure-swap-plan.md` (2026-07-09, Section 1)

Resource details:
- Name: `gg-qa-openai`
- Resource group: `gg-qa-fleet`
- Region: `eastus2`
- Kind: OpenAI
- Current deployments: `gpt-5-mini` (50 TPM), `gpt-5.4-mini` (50 TPM)
- Responses API: **confirmed working** (live test: streaming + tool-calling + previous_response_id chaining all validated)

The resource is verified operational via live API calls in the audit session.

---

### 3. Billing source — REQUIRES CONFIRMATION ⚠

**What the docs say:**

- `qa-cloud-fleet-options.md` (Section B4, line 9): "The founder has $1,000 in Microsoft for Startups credit already granted, **expiring 2026-09-19 (use-it-or-lose-it)**"
- Same doc recommends using Azure OpenAI GPT-4o-mini "funded by the same expiring Azure credits"
- `azure-swap-plan.md` mentions `gg-qa-openai` exists but does NOT explicitly state whether its subscription is on Microsoft for Startups credits, a separate paid subscription, or a mixed model

**What is NOT confirmed:**

The actual Azure subscription hosting `gg-qa-openai` could be:
- (A) Directly funded by Microsoft for Startups credits (use-it-or-lose-it, expires Sep 19)
- (B) On Yair's personal Azure card with credits applied as an overlay
- (C) Some other subscription model

**Next step:** Confirm in the Azure portal: go to Cost Management + Billing → Subscriptions, find the subscription hosting `gg-qa-fleet` resource group, and check whether it says "Microsoft for Startups" (funded) or "Yair's card" (card-billed with optional credits). If unsure, ask Yair directly.

---

### 4. Fallback OpenAI key — NOT VERIFIED ⚠

**Source:** `azure-swap-plan.md` (Section 4, `openai.ts`)

Code structure:
```typescript
export function getLLMProvider(): LLMProvider {
  return process.env.LLM_PROVIDER === 'azure' ? 'azure' : 'openai';
}

export function getOpenAIKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OpenAIError('OPENAI_API_KEY not configured', 500);
  return apiKey;
}
```

**Risk:** If both env vars are present (`LLM_PROVIDER=azure` AND `OPENAI_API_KEY`):
- The app routes to Azure by default (LLM_PROVIDER="azure" case wins)
- BUT if `OPENAI_API_KEY` is also set, it could become a fallback or be accidentally referenced in edge cases

**Verification gap:**
- `iota-azure-deploy.md` confirms `LLM_PROVIDER=azure` is present
- `iota-azure-deploy.md` does NOT report whether `OPENAI_API_KEY` is also set on the deployment

**Recommendation:** 
1. Confirm that `OPENAI_API_KEY` is **NOT** set in the Vercel environment for gg-qa-iota
2. If it IS set, either remove it or document why it's present (e.g., a fallback for a different endpoint)

This is a low-risk issue (the app prefers Azure by code structure), but clean hygiene means not having unused secrets in the environment.

---

## Summary table

| Check | Status | Evidence | Risk |
|-------|--------|----------|------|
| gg-qa-iota routed to Azure? | ✓ YES | Live deploy verified `LLM_PROVIDER=azure` + test coach turn worked | None |
| Azure resource exists? | ✓ YES | `gg-qa-openai` confirmed operational with Responses API live-tested | None |
| Using Azure credits or personal card? | ⚠ UNCLEAR | Docs reference $1K Microsoft for Startups credits, but don't confirm which subscription hosts the resource | Medium (cost tracking) |
| Fallback OpenAI key present? | ⚠ UNCONFIRMED | Code supports fallback via `OPENAI_API_KEY` env var; deployment verification doesn't report whether it's set | Low (app prefers Azure, but hygiene issue) |

---

## Answer to the original question

**Is QA LLM cost on Azure credits and NOT personal money?**

- **YES for routing:** The live deployment definitively routes to Azure (LLM_PROVIDER=azure confirmed).
- **UNCLEAR for funding source:** The Azure resource exists, but whether it's funded by the $1K Microsoft for Startups credits (expiring Sep 19) or Yair's personal card is not confirmed in the docs. Docs discuss the credits as an option, not a confirmed fact.
- **LOW RISK on fallback:** No evidence of personal OpenAI key being called, but the unused `OPENAI_API_KEY` should be confirmed absent or documented.

**Recommendation:** 
1. Confirm in Azure portal whether `gg-qa-fleet` resource group's subscription is funded by Microsoft for Startups credits.
2. Confirm Vercel env for gg-qa-iota does NOT have `OPENAI_API_KEY` set (or document if it does).
3. If both are confirmed, report: **YES, Azure credits, no personal key risk.**

---

## Files audited

- `~/Developer/claude-work/scratch/iota-azure-deploy.md` — deployment verification
- `~/Developer/claude-work/scratch/azure-swap-plan.md` — API validation + code structure
- `~/Developer/gg-spec/docs/qa-cloud-fleet-options.md` — cost analysis (mentions credits)
- `~/Developer/gg-spec/docs/human-qa-fleet-connection.md` — mentions resource endpoint location
