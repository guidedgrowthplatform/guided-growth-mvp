---
name: app-global-context
description: Use when the LLM needs to answer "what does this app do / can it do X / why this / how much will it cost / how do you handle crisis", looking up GC-XX IDs, the founding-user offer, voice cap rationale (UX-12), missing-capability handling, philosophy answers, or Brainstorm prompt routing (BR-XX)
user-invocable: false
---

# Global Context Knowledge Base

Source: Google Sheet **Guided Growth OS App Master** · tab `Global Context` · gid `6608461` · maintained by Yair (structure + philosophy) + team (capability entries).

Layer 2 of the 3-layer context architecture:
- **Layer 1** — always-injected (identity + safety + current screen + state delta).
- **Layer 2** — THIS tab. Retrieved on demand by the LLM via `lookup_global_context(topic)`.
- **Layer 3** — conditional deep-dives (coaching style content, etc.).

Each row is one topic the LLM might need to know about. **Add new rows as you discover gaps.** Content should focus on (a) what's true and (b) how the LLM should handle the moment — including which Brainstorm prompt (`BR-XX`) to fire.

## When to use
- A user message matches a known trigger phrase below and the LLM needs the canonical handling.
- Adding a new capability — does it deserve a GC entry?
- Need to know which Brainstorm prompt (`BR-XX`) pairs with which capability moment.

## Entries

| ID | Topic | Category | Trigger phrases | Content | Related Brainstorm | Status | Last Updated |
|---|---|---|---|---|---|---|---|
| GC-01 | Habits — what we track | Capability | what habits can I track / what kinds / can I add custom habits | Today the app supports custom habits the user defines themselves (no fixed library). Each habit has: name, cadence (which days of the week), reminder time (optional). Users can add unlimited habits during onboarding and from the Home screen via the add-habit flow. Mark complete via tap or voice. We track streak length, completion rate, and daily/weekly patterns. We do NOT yet support sub-habits, dependencies, or habit templates. | BR-01 if user wants something we don't have | Active | 2026-05-01 |
| GC-02 | Voice check-ins — morning + evening | Capability | what's a check-in / what do you ask in the morning / how does the evening work / can I skip check-ins | Morning check-in covers: mood, sleep, energy, stress (4 quick numbers) plus an optional voice-only goal for the day. Evening check-in covers: habit review (which ones got done) plus optional reflection if the user set up journaling. Users can skip any check-in entirely. We do not punish skips. Check-ins are the default voice surface but text/tap mode also works. | BR-06 if user starts skipping / abandons | Active | 2026-05-01 |
| GC-03 | Voice conversations — free-form | Capability | can I just talk to you / let's chat / I want to talk / can I have a conversation | Yes — free-form voice conversation is available from the Home screen mic tap. Limited to **5 free-form conversations per day (UX-12)** to keep costs sustainable. Check-ins (morning + evening) do NOT count toward this limit. When the user hits the cap, BR-02 prompt fires. | BR-02 (cap moment), BR-04/BR-05 if user wants more | Active | 2026-05-01 |
| GC-04 | Coaching styles available | Capability | can I change how you talk / different style / less warm / more direct / change personality | MVP has ONE active coaching style: **Warm & Thoughtful** (default). Two others are content-ready but not user-selectable yet: Honest & Direct, Calm & Reflective. If user asks to change style, acknowledge their preference, capture via BR-01, and explain that style selection is coming (FF-19 in Future Features). | BR-01 to capture which style they want | Active | 2026-05-01 |
| GC-05 | Reminders / push notifications | Capability — missing | set a reminder / remind me / push me a notification / nudge me / can you ping me | Push notifications are coming but NOT in MVP. Each habit has a reminder time field that the user sets, but the actual reminder delivery isn't wired yet. When user asks: acknowledge with curiosity, confirm it's coming, ask what kind of reminder would be useful (BR-01), then optionally value-score (BR-04). | BR-01, BR-04 | Active | 2026-05-01 |
| GC-06 | Calendar integration | Capability — missing | sync my calendar / Google Calendar / Apple Calendar / connect to my calendar | No calendar integration in MVP. Not on the immediate roadmap either. When user asks: acknowledge, capture intent (what would they sync, why), value-score if intensity feels real. **Don't promise a timeline.** | BR-01, BR-04, BR-05 if 8+ | Active | 2026-05-01 |
| GC-07 | Wearable integration | Capability — missing | connect my Apple Watch / Garmin / Oura / Whoop / sync my wearable | Wearable integration is on the roadmap (FF-23) for Sep-Oct 2026 (post-MVP). When user asks: acknowledge, ask which wearable they use (data point for us), capture what they'd want it to do. | BR-01 to capture which device + use case | Active | 2026-05-01 |
| GC-08 | Social / accountability features | Capability — missing | share with friends / accountability partner / can my partner see / group / challenge | Social features are roadmap (FF-28 simple, FF-29 complex). Not in MVP. When asked: acknowledge, capture what kind of social they want (partner? group? public?). High-value signal for prioritization. | BR-01, BR-04 | Active | 2026-05-01 |
| GC-09 | Insights / analytics | Capability — partial | what are my patterns / show me trends / insights / analytics / dashboard | We generate AI insights only when there are 3+ data points (UX-11). MVP has basic streak counter and completion rate. Deeper trend analysis (mood patterns, sleep correlations) is post-MVP. When user asks: surface what we DO have, capture what they wish we had. | BR-01 if they want something we don't show | Active | 2026-05-01 |
| GC-10 | Founding user — what it means | Founding | what does founding user mean / what do I get / am I a founding user / why am I free | First 50 users to onboard are founding users. They get the app **FREE for 6 months** while we figure out what to build. Their feedback directly shapes the roadmap. After 6 months they convert to paid (price TBD) but they will get the best long-term price we ever offer (loyalty pricing). They also get direct line to the founder (Yair). This is THE incentive for the first cohort — we want their honest feedback in exchange for free access. | BR-16 (general reminder), BR-09 (onboarding setup) | Active | 2026-05-01 |
| GC-11 | Pricing — after the 6 free months | Pricing | how much will it cost / what will I pay / is this paid / what's the subscription | MVP: free for founding users (6 months). After: **pricing not finalized.** Tiered model planned: Free, Plus (~$7.99/mo target), Pro (~$12.99/mo target) per growth roadmap. Specific prices TBD based on Van Westendorp PSM data we're collecting now from founding users (BR-05, BR-17). When user asks: be honest that pricing is being figured out WITH them, not for them. | BR-05, BR-17 to capture their pricing input | Active | 2026-05-01 |
| GC-12 | Why there's a voice cap | Limit | why only 5 / why can't I keep talking / what's the limit / why are you cutting me off | Voice (Cartesia) has real per-minute costs. We've capped free-form voice conversations at 5/day to keep things sustainable while we figure out what people will pay for. Check-ins (morning + evening) do NOT count — those are unlimited. The cap is honest, not punitive: we'd rather be transparent about constraints than burn cash and disappear. | BR-02 (this is the moment to ask what voice is worth) | Active | 2026-05-01 |
| GC-13 | Why voice-first | Philosophy | why voice / why not just text / why is this voice based / what's special about voice | Voice removes friction. Habit apps fail because users have to navigate menus, tap fields, remember what they wanted to log. Talking to a coach feels like a conversation, not homework. The voice IS the differentiator — friction removal is the design north star, NOT replacing 5-7 apps. | Could feed BR-12 (LinkedIn content idea) | Active | 2026-05-01 |
| GC-14 | Why founding users matter | Philosophy | why are you doing this / why founding users / what's your strategy | We're tiny. First 50 users tiny. Building a coaching app well requires real coaching feedback — what works, what doesn't, what people actually need vs what we think they need. Founding users get free access AND a real voice in product direction. We get honest feedback that shapes a product worth paying for. Mutual benefit, no marketing fluff. | BR-09, BR-16 | Active | 2026-05-01 |
| GC-15 | Crisis safety boundary | Safety override | self-harm / suicidal / want to die / kill myself / end it all / no point | If user mentions self-harm, suicidal thoughts, or wanting to die: stop coaching immediately. Respond ONCE with: "What you're feeling matters. Please reach out to 988 — call or text — they're trained for exactly this. I'm an AI and not equipped to support you the way you deserve." Do not continue normal conversation after this. **This rule overrides all other coaching behavior.** | — | Active | 2026-05-02 |
| GC-16 | _(placeholder — Anonymization / privacy user-facing message, see Architecture > Anonymization)_ | Privacy | — | _Not yet filled in the sheet._ Anonymization Architecture (P1-46) covers the implementation; this entry should hold the user-facing copy when asked about privacy. | — | TBD | — |

## Color coding (from maintainer note)

- **Orange** — capability we don't have yet (handle gracefully via BR-01/BR-04/BR-05).
- **Yellow** — high-touch moments (founding/pricing).
- **Lavender** — philosophy (rare reference).

## Architecture note

This tab syncs to Supabase `global_context` table via a planned `seed_global_context.py` (task TBD). Same pattern as `screen_contexts`. LLM tool: `lookup_global_context(topic)` returns the **Content** cell + Related Brainstorm prompts.

## Asana cross-references

- **FF-XX** = Future Features (Asana). Examples cited above: FF-19 (style selector), FF-23 (wearables), FF-28/29 (social), FF-08/09/10 (anonymization tooling).
- **BR-XX** = Brainstorm prompts (Asana). Examples: BR-01 (capture-what-they-want), BR-02 (cap moment), BR-04/05 (value-scoring), BR-09 (founding-onboarding), BR-12 (LinkedIn content), BR-16 (founding reminder), BR-17 (Van Westendorp PSM).

## Refresh

```
mcp__google-sheets__get_sheet_data(
  spreadsheet_id="1iNEdUm5vqmjk3YGEF1uMwfurcvgVRHykWUeBGHDBqcw",
  sheet="Global Context"
)
```

Trigger: "refresh app-global-context" or "resync the sheet".

_Last refreshed: 2026-05-11_
