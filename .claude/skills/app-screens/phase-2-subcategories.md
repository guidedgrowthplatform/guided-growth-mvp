# Screens — Phase 2 — Subcategory response screens (SUB-*)

Source: Google Sheet **Guided Growth OS App Master** · tab `Screens` · gid `1034476295`.

**Count:** 28 screen(s).

## Quick index

| Screen ID | Name | Type | Voice Engine | Active | Stage |
|---|---|---|---|---|---|
| `SUB-BREAK-01` | Break Bad Habits > Smoking | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-BREAK-02` | Break Bad Habits > Weed | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-BREAK-03` | Break Bad Habits > Alcohol | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-BREAK-04` | Break Bad Habits > Porn | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-BREAK-05` | Break Bad Habits > Phone use | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-BREAK-06` | Break Bad Habits > Late-night snacking | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-BREAK-07` | Break Bad Habits > Caffeine | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-EAT-01` | Eat Better > Eat more intentionally | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-EAT-02` | Eat Better > Reduce overeating | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-EAT-03` | Eat Better > Plan food better | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-ENERGY-01` | Feel Energized > Have more morning energy | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-ENERGY-02` | Feel Energized > Avoid afternoon crashes | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-ENERGY-03` | Feel Energized > Keep energy more stable | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-FOCUS-01` | Improve Focus > Start work with less friction | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-FOCUS-02` | Improve Focus > Do deeper work | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-FOCUS-03` | Improve Focus > Procrastinate less | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-MOVE-01` | Move More > Walk more | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-MOVE-02` | Move More > Exercise consistently | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-MOVE-03` | Move More > Improve mobility | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-ORG-01` | Get Organized > Stay on top of tasks | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-ORG-02` | Get Organized > Keep spaces tidy | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-SLEEP-01` | Sleep Better > Fall asleep earlier | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-SLEEP-02` | Sleep Better > Wake up earlier | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-SLEEP-03` | Sleep Better > Sleep more consistently | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-SLEEP-04` | Sleep Better > Sleep more deeply | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-STRESS-01` | Reduce Stress > Feel calmer during the day | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-STRESS-02` | Reduce Stress > Reduce evening stress | MP3-only | MP3 | Planned | Phase 2 |
| `SUB-STRESS-03` | Reduce Stress > Feel less overwhelmed | MP3-only | MP3 | Planned | Phase 2 |

## Screens

### `SUB-BREAK-01` — Break Bad Habits > Smoking

**Name:** Break Bad Habits > Smoking · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/break-01 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Smoking]

**AI Context Block:**

SCREEN: Subcategory response for Break Bad Habits > Smoking
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
SENSITIVITY: Addiction topic. No judgment. No assumptions about severity or history. No clinical language. 'One day at a time' framing.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

Quitting smoking - or even cutting back - is one of the hardest things a person can do. And the fact that you're here means you're ready to try. We'll take it one day at a time.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: No cigarettes today, No smoking before noon, Urge delay, Carry gum

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Validates difficulty. Category: Break bad habits

---

### `SUB-BREAK-02` — Break Bad Habits > Weed

**Name:** Break Bad Habits > Weed · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/break-02 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Weed]

**AI Context Block:**

SCREEN: Subcategory response for Break Bad Habits > Weed
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
SENSITIVITY: Substance topic. Non-judgmental. Respect autonomy. Don't assume they want to quit entirely - they may want to reduce.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

Changing your relationship with weed starts with noticing when and why you use it. Once you see the pattern, you can start making different choices - on your terms.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: No weed today, No weeknights, No before 8 PM, Replace with walk

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Non-judgmental. Respects autonomy. Category: Break bad habits

---

### `SUB-BREAK-03` — Break Bad Habits > Alcohol

**Name:** Break Bad Habits > Alcohol · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/break-03 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Alcohol]

**AI Context Block:**

SCREEN: Subcategory response for Break Bad Habits > Alcohol
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
SENSITIVITY: Substance topic. Reject all-or-nothing framing. Don't assume alcoholism. They may be casual drinkers wanting to cut back.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

Adjusting your drinking isn't all-or-nothing. Whether you're cutting back or taking days off, every boundary you set is a win. Let's find what works for you.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: No alcohol today, No weekdays, Max 2 drinks, Nonalcoholic first

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Rejects binary thinking. Category: Break bad habits

---

### `SUB-BREAK-04` — Break Bad Habits > Porn

**Name:** Break Bad Habits > Porn · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/break-04 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Porn]

**AI Context Block:**

SCREEN: Subcategory response for Break Bad Habits > Porn
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
SENSITIVITY: Deeply personal. Extra care. No shame. No assumptions about addiction level. No clinical or moral language.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

This is a personal one, and I respect you for putting it here. Changing this habit is about replacing the trigger, not just resisting it. Let's set up some boundaries that actually help.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: No porn today, No after 10 PM, Phone out of bedroom, Blocker on devices

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Acknowledges sensitivity. Shame-free. Category: Break bad habits

---

### `SUB-BREAK-05` — Break Bad Habits > Phone use

**Name:** Break Bad Habits > Phone use · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/break-05 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Phone use]

**AI Context Block:**

SCREEN: Subcategory response for Break Bad Habits > Phone use
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

Your phone is designed to keep you on it. That's not a personal failure - it's by design. These habits put you back in control of when and how you use it.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: No phone first 30 min, No phone meals, Phone outside bedroom, Social apps under target

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Externalizes blame. Empowering. Category: Break bad habits

---

### `SUB-BREAK-06` — Break Bad Habits > Late-night snacking

**Name:** Break Bad Habits > Late-night snacking · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/break-06 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Late-night snacking]

**AI Context Block:**

SCREEN: Subcategory response for Break Bad Habits > Late-night snacking
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

Late-night snacking is usually the habit, not actual hunger. Once you change the routine around dinner time, the urge fades on its own.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: No calories after 9 PM, Kitchen closed, Brush teeth after dinner, Evening tea

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Natural language. Freedom. Category: Break bad habits

---

### `SUB-BREAK-07` — Break Bad Habits > Caffeine

**Name:** Break Bad Habits > Caffeine · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/break-07 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Caffeine]

**AI Context Block:**

SCREEN: Subcategory response for Break Bad Habits > Caffeine
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

Caffeine isn't the enemy - timing is. When you get the timing right, you keep the energy without the crash or the sleep disruption.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: No caffeine after 2 PM, Max 2 drinks, Water before caffeine, No energy drinks

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Reframes as timing. Category: Break bad habits

---

### `SUB-EAT-01` — Eat Better > Eat more intentionally

**Name:** Eat Better > Eat more intentionally · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/eat-01 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Eat more intentionally]

**AI Context Block:**

SCREEN: Subcategory response for Eat Better > Eat more intentionally
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

Intentional eating isn't about restriction - it's about paying attention. When you actually notice what you're eating, better choices happen naturally.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: Protein at breakfast, Vegetables at lunch, Vegetables at dinner, No eating while scrolling

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Mindfulness not diet culture. Category: Eat better

---

### `SUB-EAT-02` — Eat Better > Reduce overeating

**Name:** Eat Better > Reduce overeating · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/eat-02 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Reduce overeating]

**AI Context Block:**

SCREEN: Subcategory response for Eat Better > Reduce overeating
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

Overeating is usually not about hunger - it's about patterns. Stress, routine, emotions. Once you notice what triggers it, you can start making different choices without fighting yourself.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: No second helping, One snack max, No food after 9 PM, Water before dinner

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Removes shame. Category: Eat better

---

### `SUB-EAT-03` — Eat Better > Plan food better

**Name:** Eat Better > Plan food better · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/eat-03 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Plan food better]

**AI Context Block:**

SCREEN: Subcategory response for Eat Better > Plan food better
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

The best food decisions happen the night before, not in the moment. When you plan ahead, you take willpower out of the equation.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: Plan meals tonight, Prep lunch, Groceries on selected day, Pack healthy snack

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Friction-removal. Category: Eat better

---

### `SUB-ENERGY-01` — Feel Energized > Have more morning energy

**Name:** Feel Energized > Have more morning energy · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/energy-01 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Have more morning energy]

**AI Context Block:**

SCREEN: Subcategory response for Feel Energized > Have more morning energy
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

Morning energy isn't random - it's built. What you do in the first 30 minutes after waking sets the tone for the entire day. Let's get those 30 minutes right.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: Get outside within 30 min, Water before coffee, Breakfast within 90 min, No screens after 10 PM

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Makes energy controllable. Category: Feel more energized

---

### `SUB-ENERGY-02` — Feel Energized > Avoid afternoon crashes

**Name:** Feel Energized > Avoid afternoon crashes · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/energy-02 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Avoid afternoon crashes]

**AI Context Block:**

SCREEN: Subcategory response for Feel Energized > Avoid afternoon crashes
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

That 2-3 PM crash isn't inevitable. It's usually about what you ate for lunch and whether you moved at all in the middle of the day. Small changes, big difference.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: Walk after lunch, No caffeine after 2 PM, Protein with lunch, No sugary drink after lunch

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Normalizes, offers way out. Category: Feel more energized

---

### `SUB-ENERGY-03` — Feel Energized > Keep energy more stable

**Name:** Feel Energized > Keep energy more stable · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/energy-03 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Keep energy more stable]

**AI Context Block:**

SCREEN: Subcategory response for Feel Energized > Keep energy more stable
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

Stable energy comes from the basics - water, movement, and consistent sleep. Simple things, but they compound. When your energy is steady, everything else gets easier.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: 2 liters water, Stand up each hour, Bed by target, 15-min walk

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

'They compound' adds value. Category: Feel more energized

---

### `SUB-FOCUS-01` — Improve Focus > Start work with less friction

**Name:** Improve Focus > Start work with less friction · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/focus-01 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Start work with less friction]

**AI Context Block:**

SCREEN: Subcategory response for Improve Focus > Start work with less friction
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

The hardest part of focused work is starting. Once you're in it, momentum takes over. These habits remove the friction between you and that first task.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: Write top 3, Phone in other room, Start block by target, Desk cleared

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Names the real problem. Category: Improve focus

---

### `SUB-FOCUS-02` — Improve Focus > Do deeper work

**Name:** Improve Focus > Do deeper work · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/focus-02 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Do deeper work]

**AI Context Block:**

SCREEN: Subcategory response for Improve Focus > Do deeper work
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

Deep work doesn't happen by accident - it happens by design. A block of time, no distractions, and a plan to protect it. Let's set that up.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: 45-min focus block, Two blocks, Notifications off, No social media before lunch

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Friction-removal philosophy. Category: Improve focus

---

### `SUB-FOCUS-03` — Improve Focus > Procrastinate less

**Name:** Improve Focus > Procrastinate less · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/focus-03 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Procrastinate less]

**AI Context Block:**

SCREEN: Subcategory response for Improve Focus > Procrastinate less
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

Procrastination isn't laziness - it's usually avoidance of something uncomfortable. The trick is to make starting so small that your brain can't say no. Ten minutes on the hardest thing. That's it.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: Hardest task first, 10 min on avoided task, Block sites, Choose must-do night before

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Removes shame. Concrete action. Category: Improve focus

---

### `SUB-MOVE-01` — Move More > Walk more

**Name:** Move More > Walk more · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/move-01 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Walk more]

**AI Context Block:**

SCREEN: Subcategory response for Move More > Walk more
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

Walking is the most underrated form of movement. It clears your head, boosts your energy, and it's something you can do every single day without burning out. Let's build it in.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: 8,000+ steps, Walk after lunch, Walk after dinner, Stand up each work hour

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Elevates walking. Category: Move more

---

### `SUB-MOVE-02` — Move More > Exercise consistently

**Name:** Move More > Exercise consistently · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/move-02 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Exercise consistently]

**AI Context Block:**

SCREEN: Subcategory response for Move More > Exercise consistently
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

The key isn't working out harder - it's working out consistently. Two or three times a week, done reliably, beats five times a week done for two weeks and then nothing.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: Workout 2 days, Workout 3 days, 20-min home workout, Lay out clothes night before

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Permission to start moderate. Category: Move more

---

### `SUB-MOVE-03` — Move More > Improve mobility

**Name:** Move More > Improve mobility · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/move-03 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Improve mobility]

**AI Context Block:**

SCREEN: Subcategory response for Move More > Improve mobility
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

A few minutes of stretching a day does more than people expect. It protects your body, clears tension, and makes everything else you do feel easier.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: Morning stretch, Post-work stretch, Post-workout stretch, Desk stretch at 3 PM

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Leads with benefit. Category: Move more

---

### `SUB-ORG-01` — Get Organized > Stay on top of tasks

**Name:** Get Organized > Stay on top of tasks · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/org-01 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Stay on top of tasks]

**AI Context Block:**

SCREEN: Subcategory response for Get Organized > Stay on top of tasks
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

The feeling of being behind on tasks usually comes from not having one clear system. When everything lives in one place and you check it daily, the chaos settles.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: Check task list, One list only, Plan tomorrow, Clear inbox

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

'Chaos settles' is calming. Category: Get more organized

---

### `SUB-ORG-02` — Get Organized > Keep spaces tidy

**Name:** Get Organized > Keep spaces tidy · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/org-02 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Keep spaces tidy]

**AI Context Block:**

SCREEN: Subcategory response for Get Organized > Keep spaces tidy
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

Your physical space affects your mental space more than most people realize. A quick daily reset keeps clutter from piling up and your mind from feeling heavy.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: Desk reset, Evening tidy, Clothes away, Weekly reset block

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Physical to mental. Category: Get more organized

---

### `SUB-SLEEP-01` — Sleep Better > Fall asleep earlier

**Name:** Sleep Better > Fall asleep earlier · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/sleep-01 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Fall asleep earlier]

**AI Context Block:**

SCREEN: Subcategory response for Sleep Better > Fall asleep earlier
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

I hear that a lot. And here's the thing - it's usually not about willpower. It's about what happens in the hour before bed. A couple of small shifts there change everything.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: No caffeine after 2 PM, No screens after 10 PM, Start wind-down by 10 PM, Be in bed by target

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Normalizes. Reframes pre-bed routine. Category: Sleep better

---

### `SUB-SLEEP-02` — Sleep Better > Wake up earlier

**Name:** Sleep Better > Wake up earlier · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/sleep-02 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Wake up earlier]

**AI Context Block:**

SCREEN: Subcategory response for Sleep Better > Wake up earlier
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

The secret to waking up earlier actually starts the night before. When your evening is set up right, mornings take care of themselves.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: Out of bed by target, No snooze, Phone outside bedroom, Lights out by target

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Counterintuitive insight. Category: Sleep better

---

### `SUB-SLEEP-03` — Sleep Better > Sleep more consistently

**Name:** Sleep Better > Sleep more consistently · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/sleep-03 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Sleep more consistently]

**AI Context Block:**

SCREEN: Subcategory response for Sleep Better > Sleep more consistently
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

Consistency is where the real gains are. Your body has a rhythm - and when you work with it instead of against it, everything improves. Sleep, energy, mood.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: Same bedtime within 30 min, Same wake within 30 min, No screens in bed, No food after 9 PM

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Positions consistency as leverage. Category: Sleep better

---

### `SUB-SLEEP-04` — Sleep Better > Sleep more deeply

**Name:** Sleep Better > Sleep more deeply · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/sleep-04 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Sleep more deeply]

**AI Context Block:**

SCREEN: Subcategory response for Sleep Better > Sleep more deeply
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

Deep sleep is where your body actually recovers. Most people don't realize how much their environment and evening choices affect sleep quality - not just how long you sleep, but how well.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: Cool dark bedroom, No alcohol on sleep nights, No heavy meal 2hrs before, Read 10 pages

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Quantity vs quality insight. Category: Sleep better

---

### `SUB-STRESS-01` — Reduce Stress > Feel calmer during the day

**Name:** Reduce Stress > Feel calmer during the day · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/stress-01 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Feel calmer during the day]

**AI Context Block:**

SCREEN: Subcategory response for Reduce Stress > Feel calmer during the day
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

Stress builds when you don't give yourself any breaks. Even two minutes of intentional pause in a busy day can reset how you feel.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: 5-min breathing, Walk without phone, No notifications first block, 2-min reset at lunch

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Concise. Tiny breaks reset stress. Category: Reduce stress

---

### `SUB-STRESS-02` — Reduce Stress > Reduce evening stress

**Name:** Reduce Stress > Reduce evening stress · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/stress-02 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Reduce evening stress]

**AI Context Block:**

SCREEN: Subcategory response for Reduce Stress > Reduce evening stress
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

Evening stress is usually the day catching up with you. When you create a clear boundary between work and rest, your evenings actually become yours again.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: End work by target, Top 3 before bed, No work email after target, 10-min wind-down

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

Emotionally resonant. Category: Reduce stress

---

### `SUB-STRESS-03` — Reduce Stress > Feel less overwhelmed

**Name:** Reduce Stress > Feel less overwhelmed · **Phase:** Phase 2 · **Active:** Planned · **Type:** MP3-only · **Row Type:** Subcategory Data · **Route:** /onboard/sub/stress-03 · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Phase 2 · **UX Rules:** UX-13, UX-14 · **PostHog:** select_specific_goals · **session_log:** navigate, voice_started, voice_ended

**Screen text (Figma):**

[Subcategory: Feel less overwhelmed]

**AI Context Block:**

SCREEN: Subcategory response for Reduce Stress > Feel less overwhelmed
STATE: User selected this subcategory at ONBOARD-BEGINNER-02.
BEHAVIOR: Play the subcategory-specific coaching response. This is a key moment - the first time the coach responds to something personal the user shared. The response should normalize their choice, reframe it constructively, and build confidence.
NEXT: Response plays -> transition to ONBOARD-BEGINNER-03 (habit selection for this subcategory).

**Voice Content:**

Overwhelm usually comes from carrying everything in your head. The moment you get it out - onto a list, a plan, anything external - it shrinks. Let's build that system.

**Voice Instructions:**

[MVP: Vapi agent speaks live (continues from ONBOARD-BEGINNER-02 session)]
[Phase 2: Pre-recorded MP3 in Yair's cloned voice replaces live TTS (Vapi) for this screen]

**Voice Notes:**

MVP: Vapi agent speaks live. Phase 2: pre-recorded MP3 in cloned voice (auto-generated from canonical text).

**Expected user response:**

User selected via voice or tap.
Habits: Capture all tasks, 15-min admin block, Say no to one task, Screen-free break

**AI Response:**

[AI plays the response above, then transitions to ONBOARD-BEGINNER-03]

**System Action:**

1. Save subcategory
2. Query habits DB
3. Play voice (Vapi for MVP, dedicated MP3 in Phase 2)
4. Navigate to ONBOARD-BEGINNER-03

**Edge Cases:**

If user wants to change subcategory: route back to ONBOARD-BEGINNER-02.

**Notes:**

'It shrinks' is hopeful. Category: Reduce stress

---

_Last refreshed: 2026-05-11_