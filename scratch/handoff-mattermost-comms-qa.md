PLEASE INJECT IN A NEW SESSION (AI): QA and improve the team Mattermost communication system.

**Goal.** Audit how the team communicates over Mattermost and make it more efficient and more relevant, for both the AI sessions and the humans. Two failure modes to fix. (1) Noise for the AI listeners: the bot's own posts echo back into the inbox, so a listening session keeps waking on its own messages. (2) Humans getting the wrong amount of signal: they should be pinged when they need to know or act, and left alone for routine AI-to-AI chatter. They do not need to know all the things.

**The current system (read and map it first).**
- Skill and scripts: gg-spec/skills/team-mattermost/ . mm.py has subcommands post, react, read, watch, dm, serve, inbox; install-watcher.sh installs the launchd watcher.
- Model: post-all, listen-by-role. Every session posts a presence line; only active or conductor sessions listen. The watcher com.gg.mm-watcher.all writes new messages to ~/.config/guided-growth/mm-inbox.jsonl; sessions read them with mm.py inbox --drain.
- Channels: one ai-<name> per person (ai-yonas, ai-mint, ai-timothy, ai-alejandro, ai-yair, ai-sandbox). Claude-to-Claude goes through the ai-<name> channels on purpose, so the human on that channel stays in the loop. Reaction convention: robot_face on read, white_check_mark on done.
- SessionStart presence hook: ~/.claude/hooks/mm-connect.sh auto-posts a one-line presence for every GG-context session.

**What to investigate and fix.**
1. Self-echo noise. The inbox surfaces the session's OWN posts, so a listener wakes on its own messages (observed live: a conductor listener fired repeatedly on its own posts). Fix so a listener does not surface posts it authored (filter by author equals the bot or the current session at the watcher or the inbox-drain layer). Verify a session no longer wakes on its own posts.
2. Human signal relevance. Define "need to know" versus "nice to know." A human should be @tagged, and therefore notified, ONLY when they need to act or be aware. Routine AI-to-AI status must not ping a human. Tie this to the standing tagging rule (tag the human when the message is for the human; an AI message needs no tag). Propose the model: per-message pings, a periodic digest, or a "you are needed" inbox, and how urgency or priority is marked so a real ask stands out from chatter.
3. Efficiency. Reduce redundant drains and re-arms. Compare the WebSocket wake (mm.py serve) against the current tail-count polling loop. Fix the double-delivery seen in drains (each post currently appears twice).
4. Conventions. Tighten the read/done reaction convention, the message styling, and when to use a channel versus a DM.

**Deliverable.** A short proposal doc in gg-spec (docs/) covering the above with concrete recommendations, PLUS implement the safe, high-value fixes directly, at minimum the self-echo filter and the human-notification relevance model. Do not break the existing watcher or inbox for live sessions; test each change before landing it. Report back with what changed and what still needs a human decision.
