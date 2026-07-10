PLEASE INJECT IN A NEW SESSION (AI).  [session id: comms-system]

Own the team Mattermost comms-system improvements. This is infra, keep it off the conductor's plate. On start, connect to Mattermost per the team-mattermost skill (set GG_SESSION=comms-system, post a presence line to ai-sandbox).

REPO: ~/Developer/gg-spec/skills/team-mattermost/ . Push to gg-spec main (skill + SOP live there). Do NOT break the live launchd watcher: com.gg.mm-watcher.all is currently running `mm.py serve --channel ai-yair --channel ai-mint --channel ai-yonas --channel ai-alejandro --channel ai-timothy --mention yairamsel`. Test every change in a SEPARATE serve instance writing to a TEMP inbox before you reinstall the launchd job.

THREE tasks:

1. DM WATCHER (the priority).
   Problem: the watcher only catches ai-* channels + @mentions, so a human reply typed into the bot's DM thread is invisible. The conductor had to read Yair's DM reply through the raw REST API by hand. That is the gap.
   Fix in mm.py `cmd_serve` (starts line ~744; the filter is `hit_channel = ch_name in channels` at ~816). The WebSocket 'posted' event `data` carries the channel type; a direct message is channel_type 'D'. Steps:
   - First, log one live 'posted' event's `data` keys to confirm the exact field (expected `data.get("channel_type") == "D"`; sender is `data.get("sender_name")`).
   - Add `is_dm = data.get("channel_type") == "D"`, a `hit_dm = is_dm` branch alongside hit_channel/hit_mention, set `reason "dm"`, include it in the write filter (`if not (hit_channel or hit_mention or hit_dm): continue`).
   - Gate behind a `--watch-dms` flag, default ON for the `--all` (conductor) install.
   - Keep the existing self-echo filter (props `gg_origin` in self_origins) so the bot never wakes on its own DM sends.
   - Add `--watch-dms` to install-watcher.sh (the `--all` branch, L38).
   TEST: DM the bot from Yair's account (or a second account), confirm it lands in the inbox with reason 'dm'; confirm the bot's OWN DM send does NOT self-wake the watcher. Then reinstall the launchd watcher and confirm it still catches the ai-* channels too.

2. REPLY-WATCHDOG (Yonas's ask, Yair approved).
   Problem: a dispatched session can silently drift because nobody re-checks it.
   Build: when the conductor sends a task to a session (`post --to <id>`), track it as a pending dispatch in a small state file (to-session, post_id, ts, one-line topic). Add a `mm.py pending` subcommand that reads the dispatch log + the inbox and prints dispatches still awaiting a reply from that session past a window (default 10-15 min). Design it so the conductor loop can call `mm.py pending` each cycle and re-ping the stale ones. Keep it simple, do not over-build.

3. CONVENTION + SOP.
   Update AI-COMMS-SOP.md (and SKILL.md where it mirrors) to lock the two-lane rule Yair set:
   - Routine / FYI / AI-to-AI coordination -> post in the ai-<name> channel (no ping).
   - Needs Yair to act or decide -> the bot DMs Yair directly (a session tells its Claude "this needs Yair" and it DMs him).
   The DM is now the explicit needs-Yair attention path, superseding burying a needs-you message as an in-channel @mention. Keep the tap-to-confirm ack + reaction conventions as-is.
   When done, post a one-line convention summary to the team channels, and a short confirm to Mint that the DM line-check worked (his Claude sent the line-check both ways, both landed).

DELIVERABLE: land 1-3 on gg-spec main; verify the live watcher still works AND now catches DMs; report to ai-yair (tag Yair only if a real decision is needed). Technical anchors: mm.py cmd_serve L744-836, install-watcher.sh person/all logic L20-39, AI-COMMS-SOP.md.
