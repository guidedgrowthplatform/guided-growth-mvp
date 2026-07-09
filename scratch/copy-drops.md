# Locked copy drops (from Yair, via ai-yair)

Durable capture of finalized onboarding copy as it lands, so the fill/build uses final wording, not COPY-PENDING placeholders. Preset for all onboarding MP3/Verbatim clips: sonic-3.5-2026-05-04, Pro Voice Clone V1, id 104635f9.

## Batch 1 (post mwgi8hnqzpf5zcnqj79s7budie)

3 lines locked, 4 clips to regen. Action per line: edit script[] in beatsSource.ts, regen the clip on the locked preset, update captions/timings, flip recording-table row keep -> re-record.

**Row 14** `onboard_morning_setup_1.wav`
> You'll do this each day. Two reasons. One, it's a quick read on how you're doing, and it's usually not done enough even though it's beneficial. Two, over time it shows the link between what you do and how you feel. When works each morning? I'd say about 15 minutes after you wake up.

**Row 68** `onboard_advanced_1.wav`
> Read me the habits you already track. We'll pick days next. For now just the list, and I recommend starting small, you can always add more.

**Row 67** `onboard_beginner_04_2.wav` (mirror to **Row 71** `onboard_advanced_frequency_1.wav`)
> Not every habit needs to be daily. Some make sense every day, some a few times a week, some once a week. Set each one to what fits.

## Batch 2 (posts hawx93i3h3ydujqhf9jprd4w6a + bm9znwbu83gefnicsjos7cyb6o) - the rest of the copy

Two parts, both need render/engine work to go live.

**A. NEW per-habit acknowledgment layer (structure + 110 clips).** After a habit is picked (tapped or spoken), the coach says one short allusive line that regards the habit without repeating it, once per picked habit, up to 2, BEFORE the schedule beat. Copy final + approved. Full spec + clip list + settings: `gg-spec/docs/onboarding-habit-ack-2026-07-09.md`.
- Engine resolves clip by picked habit id -> `onboard_habit_ack_<slug>` (clip-by-text is the default resolve, rule 16).
- Shared-habit ids (2+ goals) map to one shared clip (marked with a return arrow); custom/freeform habit -> the fallback clip. 110 unique clips cover 116 slots.
- Output dir `public/voice/ob/`.
- New rules 27-29 in `gg-spec/docs/onboarding-copy-flow-rules.md` (allude-not-repeat, one clip per habit with no tapped/said split, shared clips goal-neutral, frequency line covers mixed cadences). Session log: `docs/handoff-copy-brainstorming.md`.
- `onboard_habit_ack_` is the clip FAMILY, not a beat id. Confirm the beat prefix/number against the render.

**B. The same 3 shortened lines / 4 re-records as Batch 1.**

**Locked onboarding-mp3 preset (all of the above):** model `sonic-3.5-2026-05-04`, voice Pro Voice Clone V1 id `104635f9-8991-403c-9988-bc5b70b39939`, speed `slow`, emotion `none`, lang `en`, WAV 44100 / 16-bit / mono, endpoint `https://api.cartesia.ai/tts/bytes`, header `2024-11-13`, key `~/.config/guided-growth/cartesia-key.txt`. Protocol: test 2-3 samples, listen page, Yair yes, then batch (~$0.75 for ~110).
