# Screens — Phase 1 — Onboarding, Home & Check-ins (MVP launch path)

Source: Google Sheet **Guided Growth OS App Master** · tab `Screens` · gid `1034476295`.

**Count:** 22 screen(s).

## Quick index

| Screen ID | Name | Type | Voice Engine | Active | Stage |
|---|---|---|---|---|---|
| `SPLASH` | Splash / Loading screen | Silent | None | Yes | Stage 3 |
| `WELCOME` | Welcome (voice hook) | LLM-active | MP3 | Yes | Stage 3 |
| `AUTH-SIGNUP` | Create Account (Email signup) | Silent | None | Yes | Stage 3 |
| `AUTH-LOGIN` | Welcome Back (Login) | Silent | None | Yes | Stage 3 |
| `VOICE-PREFERENCE` | Voice/Screen Preference | LLM-active | Vapi | Yes | Stage 3 |
| `MIC-PERMISSION` | Mic Permission | LLM-active | Vapi | Yes | Stage 3 |
| `POST-AUTH-01 [DEPRECATED]` | Welcome Coach Introduction | LLM-active | Vapi | Yes | Stage 3 |
| `ONBOARD-01` | Profile Setup | LLM-active | Vapi | Planned | Stage 3 |
| `ONBOARD-FORK` | Experience Fork | LLM-active | Vapi | Planned | Stage 3 |
| `ONBOARD-BEGINNER-01` | Category Selection | Hybrid | Vapi | Planned | Stage 3 |
| `ONBOARD-BEGINNER-02` | Subcategory Selection | LLM-active | Vapi | Planned | Stage 3 |
| `ONBOARD-BEGINNER-03` | Habit Selection | LLM-active | Vapi | Planned | Stage 3 |
| `ONBOARD-BEGINNER-04` | Habit Configuration | LLM-active | Vapi | Planned | Stage 3 |
| `ONBOARD-BEGINNER-06` | Review Habits | LLM-active | Vapi | Planned | Stage 3 |
| `ONBOARD-BEGINNER-07` | Journal Setup | LLM-active | Vapi | Planned | Stage 3 |
| `STARTING-PLAN` | Plan Summary + Start | LLM-active | Vapi | Planned | Stage 3 |
| `ONBOARD-ADVANCED-03` | Advanced - Voice Journal Intro | LLM-active | Vapi | Yes | Stage 3 |
| `ONBOARD-ADVANCED-04` | Advanced - Journal Mode Choice | LLM-active | Vapi | Yes | Stage 3 |
| `ONBOARD-ADVANCED-05` | Advanced - Your Starting Plan | LLM-active | Vapi | Yes | Stage 3 |
| `ONBOARD-BEGINNER-05` | Beginner - Configure Habit #2 | LLM-active | Vapi | Yes | Stage 4 |
| `ONBOARD-BEGINNER-08` | Beginner - Journal Mode Choice | LLM-active | Vapi | Yes | Stage 4 |
| `ONBOARD-BEGINNER-09` | Beginner - Check-in Schedule | LLM-active | Vapi | Yes | Stage 4 |

## Screens

### `SPLASH` — Splash / Loading screen

**Name:** Splash / Loading screen · **Phase:** Phase 1 · **Active:** Yes · **Type:** Silent · **Row Type:** Screen · **Route:** / · **Voice Engine:** None · **Stage:** Stage 3 · **PostHog:** view_signup_screen · **session_log:** navigate · **Tasks:** P1-17 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1220-6287 · **Figma node:** 1220:6287

**Screen text (Figma):**

Guided Growth
Your AI coach is ready.

**AI Context Block:**

SCREEN: Splash (loading)
STATE: App is loading. Brief loading screen with logo.
BEHAVIOR: Silent. Display logo while app initializes. Once loaded, auto-navigate to WELCOME.
DO NOT: Play any voice. Show auth buttons (those are on WELCOME).
NEXT: Auto-navigate to WELCOME when app is ready.

**Voice Content:**

[No voice - loading screen]

**Voice Instructions:**

[Silent]

**Voice Notes:**

Splash is the loading screen (logo). Silent. No voice plays here. The voice hook plays on the next screen after load.

**Expected user response:**

None. Screen auto-transitions.

**AI Response:**

-

**System Action:**

1. Display logo
2. Initialize app (Supabase, Cartesia)
3. Auto-navigate to WELCOME

**Edge Cases:**

Slow connection: show loading indicator. Don't hang on splash.

**Notes:**

Brief loading screen. 1-2 seconds max.

---

### `WELCOME` — Welcome (voice hook)

**Name:** Welcome (voice hook) · **Phase:** Phase 1 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /welcome · **Voice Engine:** MP3 · **Voice Mode:** Verbatim · **Stage:** Stage 3 · **UX Rules:** UX-04, UX-09, UX-15 · **PostHog:** view_signup_screen, start_signup · **session_log:** navigate, voice_started, voice_ended, auth_started · **Tasks:** P1-17, P1-42 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1211-3435 · **Figma node:** 1211:3435

**Screen text (Figma):**

Guided Growth
Hi, I'm your AI Coach. I'm
here to help improve your behavior in any area
of your life that you want!
Get Started
Already have an account? Log in

**AI Context Block:**

SCREEN: Welcome (first open, voice hook)
STATE: App has finished loading. User sees the welcome screen for the first time. No account yet. No mic access.
BEHAVIOR: Auto-play the welcome hook (~8 sec) via Vapi agent live TTS in cloned voice (NOT a pre-recorded MP3 - this changed in v2 plan). Do NOT request mic. The voice plays one-way - this is a broadcast, not a conversation. Stop audio (terminate Vapi session) immediately if user taps any auth button.
GOAL: Hook the user with the surprise of voice. Create curiosity. Drive signup.
DO NOT: Ask questions. Wait for voice input. Play anything after the hook ends.
NEXT: Any auth button -> AUTH-SIGNUP or AUTH-LOGIN. After auth -> VOICE-PREFERENCE (voice preference).

**Voice Content:**

Hey there. ...I might have startled you. You probably aren't used to an app just talking to you. I'm your AI coach inside Guided Growth - and I'd love to tell you more. Sign up, and we'll continue right where we left off.

**Voice Notes:**

Vapi agent speaks live, no pre-recorded MP3 (changed from MP3-only in v2 plan)

**Expected user response:**

Tap: Continue with Apple
Tap: Continue with Google
Tap: Sign up with email
Tap: Log In

No voice input expected here.

**AI Response:**

-

**System Action:**

1. On screen load: connect to Vapi agent and play welcome hook (~8 sec) via live TTS in cloned voice
2. On any auth button tap: terminate Vapi session immediately
3. Route to OAuth flow or email signup form
4. On OAuth success: extract name (Google: given_name, Apple: givenName)
5. Save user_profile {email, name, auth_method}
6. Set onboarding_state = 'welcome'
7. Navigate to VOICE-PREFERENCE
8. Set first_open = true in localStorage

**Edge Cases:**

Audio MUST complete or stop before OAuth redirect.
RETURNING VISIT (not logged in, already heard hook): No voice. Skip Vapi connection. Normal auth flow. Check localStorage first_open flag.
RETURN FROM 'COME BACK LATER': Short voice via voice orchestrator: 'Hey - you're back. Ready to set up?' Then normal auth or skip to VOICE-PREFERENCE if already authed.

**Notes:**

~8 sec. Hook + coach intro + reason to sign up.

**Mint:**

In the /welcome we don't have the auth options, it's just 'Get started'.  

check 3L [user expected response]

---

### `AUTH-SIGNUP` — Create Account (Email signup)

**Name:** Create Account (Email signup) · **Phase:** Phase 1 · **Active:** Yes · **Type:** Silent · **Row Type:** Screen · **Route:** /auth/signup · **Voice Engine:** None · **Stage:** Stage 3 · **PostHog:** complete_signup, signup_error · **session_log:** navigate, form_submit · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1211-3557 · **Figma node:** 1211:3557

**Screen text (Figma):**

Create an Account
Your AI coach is ready
Continue with Apple
Continue with Google
or continue with email
Email Address
Password
Sign Up
Already have an account?
Log In

**AI Context Block:**

SCREEN: Create Account (email signup)
STATE: No voice. No mic. Pure form.
BEHAVIOR: Silent. No coach presence on this screen. Let them sign up quickly.
NEXT: On signup success -> VOICE-PREFERENCE.

**Voice Instructions:**

[No voice on this screen]

**Voice Notes:**

No voice. Pure auth form.

**Expected user response:**

Type: email + password
Tap: Sign Up
Tap: Log In (redirect)

**AI Response:**

-

**System Action:**

1. Validate email format, password strength (min 8 chars)
2. Supabase auth.signUp()
3. No name from email signup
4. Set onboarding_state = 'welcome'
5. Navigate to VOICE-PREFERENCE (voice preference)

**Edge Cases:**

Weak password: inline error 'Password needs at least 8 characters.'
Email exists: 'This email already has an account. Try logging in.'
Invalid email: 'Please enter a valid email address.'
Network error: 'Connection issue. Check your internet and try again.'

**Notes:**

Fast, functional.

**Mint:**

The continue with google/apple options should be here not in the /welcome screen

---

### `AUTH-LOGIN` — Welcome Back (Login)

**Name:** Welcome Back (Login) · **Phase:** Phase 1 · **Active:** Yes · **Type:** Silent · **Row Type:** Screen · **Route:** /auth/login · **Voice Engine:** None · **Stage:** Stage 3 · **PostHog:** complete_login, login_error · **session_log:** navigate, form_submit · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1211-3612 · **Figma node:** 1211:3612

**Screen text (Figma):**

Welcome!
Let's check in with your habits today.
Continue with Apple
Continue with Google
or login with email
Email Address
Password
Forgot Password?
Log In
Don't have an account?
Sign Up

**AI Context Block:**

SCREEN: Login (returning user)
STATE: No voice. User has an existing account.
BEHAVIOR: Silent. Voice greets on Home after login, not here.
NEXT: On login success -> Home (HOME-MORNING or HOME-EVENING based on time).

**Voice Instructions:**

[No voice on login - voice greets on Home after login]

**Voice Notes:**

No voice. Voice greets on Home after login.

**Expected user response:**

Tap: OAuth
Type: email + password
Tap: Log In
Tap: Forgot Password
Tap: Sign Up

**AI Response:**

-

**System Action:**

1. Supabase auth.signIn()
2. On success: fetch user_profile + today's habits + pending goals
3. Navigate to Home
4. Home screen plays welcome back voice (see HOME-MORNING)

**Edge Cases:**

Wrong password: 'Incorrect password. Try again or tap Forgot Password.'
Account not found: 'No account with that email. Want to sign up?'
Forgot Password: Supabase password reset email flow

**Notes:**

Voice greeting happens on Home, not here.

---

### `VOICE-PREFERENCE` — Voice/Screen Preference

**Name:** Voice/Screen Preference · **Phase:** Phase 1 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /onboard/preference · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 3 · **UX Rules:** UX-04, UX-09, UX-17 · **PostHog:** complete_onboarding_step, llm_call · **session_log:** navigate, voice_started, voice_ended, form_submit · **Tasks:** P1-18, P1-42 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1211-3468 · **Figma node:** 1211:3468

**Screen text (Figma):**

Can I talk?
Do you prefer that I talk, or write on the screen to you? If you'd like me to talk, just say yes. If not, say screen.
I am always listening when this is blue. I will gray out if you go quiet.
Talk to me
Screen is fine

**AI Context Block:**

SCREEN: Voice/Screen Preference ('Can I talk?')
STATE: User just completed auth. First interaction with coach presence. No mic access yet.
BEHAVIOR: Vapi agent speaks live (one-way broadcast on this screen, ~6 sec). User responds by TAP only - mic hasn't been granted yet. Display two buttons: 'Talk to me' and 'Screen is fine.' (NOT a pre-recorded MP3 - changed in v2 plan to all-Vapi onboarding.)
TWO INDEPENDENT SETTINGS:
1. ai_output_mode (set here): Does the AI speak or write? 'voice' = TTS, 'screen' = text.
2. mic_permission (set at MIC-PERMISSION): Can the user speak? On or off. Defaults to on if granted.
These are independent. A user can have AI in screen mode but still use their mic to talk.
GOAL: Let user choose comfort level. Voice is preferred but screen is fully supported.
DO NOT: Imply voice response is available. Make screen mode feel lesser.
NEXT: Both paths -> MIC-PERMISSION.

**Voice Content:**

Can I talk? I have something to share with you. Do you prefer that I talk, or write on the screen? Tap 'Talk to me' or 'Screen is fine.'

**Voice Instructions:**

[Vapi agent speaks one-way - like a broadcast. Mic is NOT active yet on this screen.]
[User responds by TAP only. Voice input not available.]
[~6 sec live TTS in cloned voice]

**Voice Notes:**

Vapi agent speaks live (~6 sec). Tap response only - mic not yet granted. (Changed from MP3-only in v2 plan.)

**Expected user response:**

Tap: 'Talk to me' (primary button)
Tap: 'Screen is fine' (secondary button)

Note: Mic is NOT active on this screen. User responds by tap only. If no response after 10 seconds: default to 'voice', auto-navigate.

**AI Response:**

TALK: [Transition to MIC-PERMISSION for mic permission]

SCREEN: 'No problem. I'll write everything on screen. You can always switch to voice later in Settings.'

**System Action:**

1. On screen load: connect to Vapi, agent speaks 'Can I talk?' prompt via live TTS
2. Save user_profile.ai_output_mode:
   - 'Talk to me' -> 'voice'
   - 'Screen is fine' -> 'screen'
   - Default (no response/timeout) -> 'voice'
3. Terminate Vapi session
4. Navigate to MIC-PERMISSION (all paths)
5. Log PostHog: voice_preference {choice, input_method}

**Edge Cases:**

User doesn't respond (silence): After 10 seconds, default to 'voice' and navigate to MIC-PERMISSION.
User says something unclear: Show the two buttons again.
User says 'What's the difference?': 'If I talk, you'll hear my voice. If screen, I'll write everything as text. Either way, you can always talk to me using the mic button.'

**Notes:**

NEW screen. Appears after auth, before welcome. Default = 'voice' if user doesn't choose. Two independent settings: ai_output_mode (voice/screen) and mic_permission (on/off).

**Yonas:**

In the edge cases, its really confusing because in the PREFo1 in the Ai context Block[6i] you said no mic access yet and one way broadcast but in the edge cases its the opposite the user might talk  

---

### `MIC-PERMISSION` — Mic Permission

**Name:** Mic Permission · **Phase:** Phase 1 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /onboard/mic · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 3 · **UX Rules:** UX-04, UX-09 · **PostHog:** grant_mic_permission · **session_log:** navigate, mic_permission_granted, mic_permission_denied, voice_started, voice_ended · **Tasks:** P1-19, P1-42 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1223-6368 · **Figma node:** 1223:6368

**Screen text (Figma):**

Would you like to talk?
I always want to give you the option to talk to me. To do that, I need access to your microphone.
Tap to speak
Allow Microphone
Dismiss

**AI Context Block:**

SCREEN: Mic Permission
STATE: User chose voice preference (or default). Now requesting mic access.
BEHAVIOR: Vapi agent speaks pre-permission explanation live (NOT a pre-recorded MP3). Then button triggers the browser prompt. This is the single biggest friction point. The explanation must earn the permission: 'I always want to give you the option to talk to me.'
IF GRANTED: Brief confirmation via voice orchestrator. Animate the mic icon. Move to welcome. IF DENIED: Graceful fallback via voice orchestrator. 'No problem. You can always type.' No dead end.
GOAL: Get mic access without pressure. Make denied feel OK.
DO NOT: Fire the browser prompt without explanation. Block the flow on denial. Guilt.
NEXT: Regardless of result -> POST-AUTH-01 [DEPRECATED] (welcome).

**Voice Content:**

I always want to give you the option to talk to me. To do that, I need access to your microphone.

**Voice Instructions:**

[Pre-permission text spoken via Vapi live TTS (or displays as text based on ai_output_mode)]
[Button tap triggers browser permission prompt]
[After granted: agent says 'Got it. You can talk to me anytime now.' via live TTS]
[After denied: agent says 'No problem. You can always type instead. Enable mic in browser settings.' via live TTS]
[If mic already granted: skip this screen entirely]

**Voice Notes:**

Vapi agent speaks live: pre-permission (~8 sec), grant confirmation (~4 sec), or denied fallback (~5 sec). (Changed from MP3 in v2 plan.)

**Expected user response:**

ALLOW: Tap 'Allow microphone' -> browser permission prompt -> Grant
DENY: Browser prompt -> Deny / Dismiss
ALREADY GRANTED: Skip this screen entirely

**AI Response:**

GRANTED: 'Got it. You can talk to me anytime now.'
DENIED: 'No problem. You can always type instead. If you change your mind, enable it in your browser settings.'
DISMISSED: Same as denied.

**System Action:**

1. On screen load: connect to Vapi, agent speaks pre-permission via live TTS
2. Button triggers navigator.mediaDevices.getUserMedia({audio: true})
3. On grant: set mic_permission = true, agent confirms via voice orchestrator
4. On deny: set mic_permission = false, agent reassures via voice orchestrator
5. Terminate Vapi session
6. Navigate to POST-AUTH-01 [DEPRECATED]
7. Log PostHog: mic_permission {result: granted | denied | dismissed}

**Edge Cases:**

Browser blocks: explain how to enable in browser settings. User dismisses without choice: treat as denied.

**Notes:**

Single biggest friction point in the funnel.

**Yonas:**

in the Ai context block it says "You can always type.' No dead end" so my question is where can the user types his inputs

---

### `POST-AUTH-01 [DEPRECATED]` — Welcome Coach Introduction

**Name:** Welcome Coach Introduction · **Phase:** Phase 1 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Deprecated · **Route:** /onboard/welcome · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 3 · **UX Rules:** UX-04, UX-15, UX-20 · **PostHog:** complete_onboarding_step, llm_call · **session_log:** navigate, voice_started, voice_ended, form_submit · **Tasks:** P1-20, P1-42

**Screen text (Figma):**

Button: "I'm ready - let's go"
Button: "I'll come back later"

**AI Context Block:**

SCREEN: Welcome (coach introduction)
STATE: User just completed auth (VOICE-PREFERENCE + MIC-PERMISSION). First time meeting the coach. Mic may or may not be granted.
BEHAVIOR: Vapi agent speaks the welcome audio live (~60 sec) via live TTS in cloned voice (NOT a pre-recorded MP3 - changed in v2 plan). This is the trust-building moment. Cover: what the app is, how check-ins work (30 sec to a couple of minutes), time framing (2-5 min setup), privacy (anonymized from day one, used for insights), and the invitation to begin. After user taps 'I'm ready', agent speaks the presence ask (~25 sec): focus, paradox (app asking you to be present), 'talking to your phone is better than being on your phone.'
GOAL: Build trust. Set expectations. Earn the right to their time.
DO NOT: Rush. Skip privacy. Make it feel like a terms-and-conditions moment. If user taps 'I'm ready' before welcome finishes, terminate the Vapi session and start the presence ask.
NEXT: After presence ask -> ONBOARD-01 (profile setup). If 'Come back later' -> save state, resume here on return.

**Voice Content:**

Welcome. I'm your AI coach inside Guided Growth, and I'm going to be with you from here on.

This isn't an app that gives you a list and hopes for the best. You'll talk to me in the morning. You'll talk to me at night. And between those two moments, the habits you want will start happening - not because you're forcing them, but because we're removing what's in the way.

This setup takes about three to five minutes. This is probably the longest we'll ever talk. After this, your check-ins are between 30 seconds and a couple of minutes, depending on how much you want to share. And those few minutes a day? They're designed to save you time - not add to your schedule. When the right habits click into place, you stop wasting energy on the things that weren't working. That's time back. Real time.

Everything you share with me - your mood, your habits, your reflections - we use all of it to give you better insights and to keep improving this experience. But here's the thing: your data is anonymized from the first second. We never connect it to you personally. So you get deep, real reflections about your life - without anyone knowing it's you. That's the best of both worlds.

When you're ready, let's begin.

**Voice Instructions:**

[Vapi agent speaks live after VOICE-PREFERENCE + MIC-PERMISSION]
[Name variant: If user_profile.name exists, prefix with 'Welcome, [Name].' If no name, use 'Welcome.' Live TTS, dynamically generated.]
[~60 sec without presence ask. Presence ask plays separately after 'I'm ready' tap (~25 sec).]
[Total ~85 sec across two moments via live TTS in cloned voice]

**Voice Notes:**

Vapi agent speaks welcome (~60s) + presence ask (~25s) via live TTS. (Changed from MP3 in v2 plan.) Auto-navigates to ONBOARD-01 after presence ask.

**Expected user response:**

Tap: 'I'm ready - let's go'
Tap: 'I'll come back later'
No voice input on this screen.

**AI Response:**

[If 'I'm ready':]
[Vapi agent speaks live, ~25 sec]
'One thing before we start. I need you here right now. Present. Not multitasking. Not half-listening. What we're about to do is focus on you - and that deserves your full attention.

I know it sounds like a paradox - an app asking you to be present. But that's actually the goal: to help you spend less time on your phone, not more. That's why you talk to me instead of scrolling. Talking to your phone is better than being on your phone.

Let's go.'

[If 'Come back later':] 'No rush. I'll be here when you're ready.'

**System Action:**

1. User arrives here after VOICE-PREFERENCE + MIC-PERMISSION (voice pref + mic permission)
2. On screen load: connect to Vapi agent
3. Check user_profile.name: if exists use it, if not use generic
4. Check ai_output_mode: if 'voice', play TTS via voice orchestrator. If 'screen', display text.
5. Vapi agent speaks welcome (~60 sec) via live TTS in cloned voice
6. Wait for button tap (welcome interruptible by tap - terminate current Vapi session)
7. On 'I'm ready': new Vapi session for presence ask (~25 sec), then onboarding_state = 'profile_setup', navigate to ONBOARD-01
8. On 'Come back later': onboarding_state = 'paused_at_welcome', terminate Vapi session
9. Log PostHog: post_auth_welcome {has_name, action, listen_duration}

**Edge Cases:**

User might tap 'I'm ready' before welcome finishes - terminate welcome Vapi session, start presence ask Vapi session.
MVP: Single cloned voice. Voice/style selection post-MVP.
Welcome is ~60 sec. Presence ask is ~25 sec after tap. Total ~85 sec split across two moments.

**Notes:**

THE moment. Split into two parts: welcome (trust + info) then presence ask (focus + paradox). Neither feels like a monologue.

**Yonas:**

In the Figma, the flow starts from Mic01  if permission is allowed, it goes to Onboarding01, and if it’s dismissed, it goes to the “I Am Your Coach” page. However, in the AI context block, it says the mic permission may or may not be granted, which creates some confusion about the expected flow.


---

### `ONBOARD-01` — Profile Setup

**Name:** Profile Setup · **Phase:** Phase 1 · **Active:** Planned · **Type:** LLM-active · **Row Type:** Screen · **Route:** /onboard/01 · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 3 · **UX Rules:** UX-02, UX-03, UX-09, UX-13, UX-14, UX-17 · **PostHog:** complete_onboarding_step, llm_call · **session_log:** navigate, voice_started, voice_ended, form_submit, llm_call · **Tasks:** P1-21, P1-42 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1248-3599

**Screen text (Figma):**

"Let's get to know you."
"Tell us a bit about yourself, to personalize your journey."
What should I call you? - field
How old are you? - slider
How do you identify? - Male/Female/Other
How did you hear about us? - Founder Invite / Webinar / Friend / Other
Mic button
Button: "Let's Begin"

**AI Context Block:**

SCREEN: Profile Setup (Step 1)
STATE: User just heard the welcome + presence ask. They're engaged and present.
*** THIS IS THE FIRST REAL-TIME AGENT SCREEN ***
Unlike screens before this (which were Vapi one-way broadcasts), this screen activates a full Vapi agent conversation. The AI speaks LIVE through real-time TTS, then listens to user voice via Soniox STT, then responds again. Everything the AI says on this screen is generated by GPT and spoken by Cartesia in the cloned voice.
FLOW:
1. Screen loads. Vapi agent connection opens automatically.
2. Agent speaks first (introduction): asks for name, age, gender, referral.
3. User responds by voice (or taps form fields).
4. Agent responds with the user's NAME via live TTS: 'Great to meet you, [Name].'
   This is the key test - the AI says the user's actual name back to them in the cloned voice.
5. If user gave partial info, agent asks for remaining fields only.
6. Form auto-fills in real-time as user speaks.
BEHAVIOR: Accept voice or taps. Auto-fill form fields as voice is parsed. If user gives partial info (just name), ask for remaining fields only - never re-ask what you already got. Confirm with a warm greeting using their name.
PARSING: 'Call me Sam' = name Sam. 'Twenty-five' = age 25. 'Guy/man/boy' = Male. 'Girl/woman/lady' = Female. 'Non-binary' = Other. 'TikTok/IG' = Social media. 'A friend' = Friend. 'Google' = Website.
DO NOT: Re-ask fields already captured. Push on gender if declined. Make referral source feel mandatory.
NEXT: All fields filled -> ONBOARD-FORK (experience fork).

**Voice Content:**

AGENT INTRODUCTION (Vapi live TTS): 'OK - let me get to know you a little. What's your name, how old are you, how do you identify, and how did you hear about us? You can just say it all or fill it in on screen.'

**Voice Instructions:**

[Vapi agent - live TTS, two-way conversation]
[Agent speaks the introduction automatically on screen load]
[Agent responds to user speech in real-time via: STT > GPT > TTS]
[Agent says the user's name back through live TTS in cloned voice]
[Form fields auto-fill as the user's speech is transcribed]
[If mic denied: introduction displays as text bubble, user fills form manually]

**Voice Notes:**

Vapi agent. Live TTS conversation. Agent says user name. No button taps needed in voice mode (per UX-03).

**Expected user response:**

FULL: 'I'm Sarah, 32, female, I found you on Instagram.'
PARTIAL: 'Sarah, 32.' / 'My name's Mike.' / 'I'm 28.'
VARIATIONS:
'Call me Sam' = name: Sam
'Twenty-five' / '25' = age: 25
'Guy' / 'man' / 'boy' = Male
'Girl' / 'woman' / 'lady' = Female
'Non-binary' = Other
'TikTok' / 'IG' = Social media
'A friend' = Friend

OR Tap: Fill form manually

**AI Response:**

*** Agent responds via Vapi live TTS (cloned voice) ***

FULL (user gave everything): 'Great to meet you, Sarah. Let's build something that actually works for you.' The agent says 'Sarah' (or whatever name the user gave) through live TTS. This is the moment - the AI coach knows their name and speaks it back.

PARTIAL (name + age only): 'Great to meet you, Sarah. And how do you identify? Also curious how you heard about us - you can just tap those on screen if you prefer.'

NAME ONLY: 'Hey [Name]. And how old are you?'

NO NAME YET: 'What should I call you?'

ALL VIA TAP (no voice): Agent does not speak a response. Form submission proceeds silently to ONBOARD-FORK.

**System Action:**

1. On screen load: open Vapi agent session
2. Agent speaks introduction
3. Parse voice with NLP: extract {name, age, gender, referral_source}
4. Auto-fill form fields in real-time
5. On 'Let's Begin': validate all fields filled
6. Save to Supabase user_profile
7. Navigate to ONBOARD-FORK (Vapi session stays open)
8. Log PostHog: complete_profile {input_method, fields_via_voice}

**Edge Cases:**

PARTIAL: AI asks for remaining fields only. Does NOT re-ask what it got.
AMBIGUOUS AGE: 'Did you say 30 or 13? Just want to make sure.'
UNCLEAR GENDER: 'I didn't catch how you identify. Male, female, or other?'
NO REFERRAL: Leave as 'Other' - not critical.
NAME UNCLEAR: 'Could you say your name one more time?'

**Notes:**

FIRST REAL-TIME AGENT SCREEN. Voice auto-fills form in real-time - magic moment #1. Agent says the user's name back via live TTS - magic moment #2. NAME PRONUNCIATION: Common names (Sarah, Mike, Tim) will pronounce correctly. Uncommon names may be mispronounced by Cartesia TTS. Known limitation for MVP.

**Mint:**

What if the user is speaking to vapi while also typing at the same time? A race condition might occur between the voice input updates and the manual text input.

**Yonas:**

In the Ai Context block it says "Unlike screens before this (which were Vapi one-way broadcasts), this screen activates a full Vapi agent conversation. The AI speaks LIVE through real-time TTS, then listens to user voice via Cartesia Ink STT" the confusing part is are we gonna use both vapi and cartesia, vapi for TSS and cartesia for STT ?

---

### `ONBOARD-FORK` — Experience Fork

**Name:** Experience Fork · **Phase:** Phase 1 · **Active:** Planned · **Type:** LLM-active · **Row Type:** Screen · **Route:** /onboard/02 · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 3 · **UX Rules:** UX-02, UX-03, UX-09, UX-13, UX-14 · **PostHog:** complete_onboarding_step, select_onboarding_path, llm_call · **session_log:** navigate, voice_started, voice_ended, form_submit, llm_call · **Tasks:** P1-22, P1-42 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1219-4458

**Screen text (Figma):**

"Let's build your plan."
"How much experience do you have with habit tracking?"
Card 1: "I'm new to habit tracking"
Card 2: "I already have experience"
Button: "Continue"

**AI Context Block:**

SCREEN: Experience Fork (Step 2)
STATE: User completed profile. You know their name. Vapi agent is still active from ONBOARD-01.
REAL-TIME AGENT CONTINUES: The Vapi assistant session stays open from ONBOARD-01. GPT already has the user's name and profile data in conversation history. All AI speech on this screen is live TTS.
BEHAVIOR: Ask if they've tracked habits before. Route based on answer:
- New/first time/tried but didn't stick -> beginner path (ONBOARD-BEGINNER-01)
- Experienced/has a list/uses another app -> advanced path (ONBOARD-ADVANCED-01)
- Ambiguous ('sort of') -> clarify: 'Would you like me to guide you step by step, or do you have a list?'
IF NEW: Validate them. 'The fact that you're here means something.' Explain morning+evening check-ins briefly. IF EXPERIENCED: Respect their experience. Direct them to bring habits over one at a time.
DO NOT: Make 'new' feel lesser. Make 'experienced' feel like they're being tested.
NEXT: New -> ONBOARD-BEGINNER-01. Experienced -> ONBOARD-ADVANCED-01.

**Voice Content:**

Quick question - have you tracked habits before, or is this new for you? Either way is great. I just want to know the best way to guide you.

**Voice Instructions:**

[Vapi agent continues from ONBOARD-01]
[Agent session stays open - same conversation context]
[All AI speech is live TTS, not pre-recorded]

**Voice Notes:**

Vapi agent continues from ONBOARD-01. Auto-routes on response (per UX-03).

**Expected user response:**

NEW: 'I'm new to this' / 'Never done it' / 'First time' / 'I've tried but never stuck with it'
EXPERIENCED: 'Yeah I've done this before' / 'I use [app] right now' / 'I have a list'
AMBIGUOUS: 'Sort of' / 'A little bit'

OR Tap: Card -> Continue

**AI Response:**

IF NEW: 'That's great. And honestly - the fact that you're here means something. A lot of people think about making changes. You actually did something about it. We're strengthening the part of you that showed up today. Let's go.'

IF EXPERIENCED: 'Nice - you've already been putting in the work. Just read them to me one by one. Tell me the name, how often, what time, and if you want a reminder. We'll get your whole system set up.'

**System Action:**

1. Parse intent: new vs experienced
2. If new: onboarding_path = 'beginner', navigate to ONBOARD-BEGINNER-01
3. If experienced: onboarding_path = 'advanced', navigate to ONBOARD-ADVANCED-01
4. Log PostHog: select_onboarding_path {path, input_method}

**Edge Cases:**

AMBIGUOUS ('sort of'): 'Sounds like you've dipped your toes in. Would you like me to guide you step by step, or do you already have a list?'
'I've tried but never stuck': route to beginner
MENTIONS SPECIFIC APP: route to advanced

**Notes:**

Figma subtitle: 'How much experience do you have with habit tracking?'

---

### `ONBOARD-BEGINNER-01` — Category Selection

**Name:** Category Selection · **Phase:** Phase 1 · **Active:** Planned · **Type:** Hybrid · **Row Type:** Screen · **Route:** /onboard/03 · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 3 · **UX Rules:** UX-02, UX-03, UX-09, UX-13, UX-14 · **PostHog:** complete_onboarding_step, select_improvement_areas, llm_call · **session_log:** navigate, voice_started, voice_ended, form_submit, llm_call · **Tasks:** P1-23, P1-42 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1219-4516 · **Figma node:** 1219:4516

**Screen text (Figma):**

What feels most worth improving right now?
Pick one area to start. You can always add more
later.
Sleep Better
Move More
Eat Better
Feel more energized
Reduce stress
Improve focus
Break bad habits
Get more organized
Continue

**AI Context Block:**

SCREEN: Category Selection (Step 3)
STATE: User chose beginner path. Ready to pick their focus area.
BEHAVIOR: Vapi agent asks what feels most worth improving. ONE category only. If they pick multiple, gently redirect: 'I'd recommend starting with one - which feels most urgent?' Each category gets a unique response - not generic praise. Sleep gets 'that's the foundation,' stress gets 'a few small habits can shift that more than you'd think,' etc.
CATEGORIES: Sleep Better, Move More, Eat Better, Feel More Energized, Reduce Stress, Improve Focus, Break Bad Habits, Get More Organized.
DO NOT: Allow multiple categories. Give generic 'great choice' responses. Overthink this moment.
NEXT: Category saved -> ONBOARD-BEGINNER-02 (subcategory).

**Voice Content:**

So - what feels most worth improving right now? Don't overthink it. There's no wrong answer. Pick the one that pulls you. We recommend starting with one - you can always add more later.

**Voice Instructions:**

[Vapi agent - live TTS, agent session continues from ONBOARD-01]
[Category responses (8 of them) can be MP3 in Phase 2 if static, but currently spoken via voice orchestrator]

**Voice Notes:**

Vapi agent prompts. Category-specific responses are live TTS for MVP, may become MP3 in Phase 2.

**Expected user response:**

SINGLE: 'Sleep' / 'I need better sleep' / 'Exercise' / 'Stress' / etc.
MULTIPLE: 'Sleep and stress' / 'A few things'

OR Tap: Card -> Continue

**AI Response:**

SLEEP: 'Sleep - yeah. That's the foundation of everything else.'
MOVE: 'Movement - great call.'
EAT: 'Eating - smart place to start.'
ENERGY: 'Energy - the one that touches everything.'
STRESS: 'Stress - a few small habits can shift that.'
FOCUS: 'Focus isn't about willpower, it's about environment.'
BREAK: 'Recognizing it is the first step.'
ORGANIZED: 'That's the one that makes everything else easier.'

MULTIPLE: 'I'd recommend starting with one. Which feels most urgent?'

**System Action:**

1. Save to user_onboarding.selected_categories[]
2. If multiple: prompt to narrow to one
3. Query habits DB for subcategories
4. Navigate to ONBOARD-BEGINNER-02
5. Log PostHog: select_category {category, input_method}

**Edge Cases:**

VAGUE ('Everything'): 'If you had to pick just one thing that would make tomorrow better than today, what would it be?'
SPECIFIC HABIT ('stop smoking'): Map to category. 'That falls under breaking bad habits. Let's go there.'

**Notes:**

One category only.

---

### `ONBOARD-BEGINNER-02` — Subcategory Selection

**Name:** Subcategory Selection · **Phase:** Phase 1 · **Active:** Planned · **Type:** LLM-active · **Row Type:** Screen · **Route:** /onboard/04 · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 3 · **UX Rules:** UX-02, UX-03, UX-09, UX-13, UX-14 · **PostHog:** complete_onboarding_step, select_specific_goals, llm_call · **session_log:** navigate, voice_started, voice_ended, form_submit, llm_call · **Tasks:** P1-23, P1-42 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1219-4713 · **Figma node:** 1219:4713

**Screen text (Figma):**

Let's narrow it down
Choose 1 or 2 specific goals to help you sleep better
Category:
Sleep Better
Fall asleep earlier
Wake up earlier
Sleep more consistently
Sleep more deeply
Continue

**AI Context Block:**

SCREEN: Subcategory (Step 4)
STATE: User picked a category. Now narrowing to 1-2 specific goals within it.
BEHAVIOR: Vapi agent asks what specific thing within [category]. Give 2-3 examples from the database. Play a unique subcategory response for whatever they pick (29 responses total, see SUB-* screens). Each response normalizes the issue and reframes it constructively.
RULES: 1 or 2 subcategories. If 1 sub = min 1 habit, max 3. If 2 subs = min 1 from each, max 3 total.
DO NOT: Let them pick more than 2 subcategories. Skip the subcategory response - it's a key coaching moment.
NEXT: Subcategory saved -> ONBOARD-BEGINNER-03 (habit selection).

**Voice Content:**

OK, within [category] - what's the specific thing? For example, [give 2-3 subcategory examples from the database]. Pick the one that hits hardest.

**Voice Instructions:**

[Vapi agent live TTS]
[Subcategory-specific response is the key coaching moment - see SUB-* screens for the 29 responses]

**Voice Notes:**

Vapi agent for MVP. 29 subcategory MP3s in Phase 2. Auto-navigates per UX-03.

**Expected user response:**

CLEAR: 'I can't fall asleep' / 'I want to wake up earlier'
VAGUE: 'All of it' / 'Just sleep in general'

OR Tap: Select -> Continue

**AI Response:**

[See SUB-SLEEP-01, SUB-SLEEP-02, etc. for the 29 subcategory-specific responses. Each is a unique coaching response that normalizes and reframes.]

**System Action:**

1. Save subcategory to user_onboarding.selected_subcategories[]
2. Query habits DB
3. Navigate to ONBOARD-BEGINNER-03
4. Log PostHog: select_subcategory {category, subcategory, input_method}

**Edge Cases:**

VAGUE: 'If you had to pick just one - what bothers you the most?'
MULTIPLE: 'Let's start with the one that feels most urgent.'

**Notes:**

1-2 subcategories. Dynamic template for examples.

---

### `ONBOARD-BEGINNER-03` — Habit Selection

**Name:** Habit Selection · **Phase:** Phase 1 · **Active:** Planned · **Type:** LLM-active · **Row Type:** Screen · **Route:** /onboard/05 · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 3 · **UX Rules:** UX-02, UX-03, UX-09, UX-13, UX-14 · **PostHog:** complete_onboarding_step, configure_habit_onboarding, create_habit, llm_call · **session_log:** navigate, voice_started, voice_ended, form_submit, habit_added, llm_call · **Tasks:** P1-23, P1-42 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1219-4762 · **Figma node:** 1219:4762

**Screen text (Figma):**

Here's a good place to start
Select up to 2 daily habits to build your foundation.
Fall Sleep Earlier
Habit List
No screens after 10 PM
No caffeine after 2 PM
Start wind-down by 10 PM
Be in bed by target bedtime
No snooze
No food after 9 PM
Create your own habit!
Continue

**AI Context Block:**

SCREEN: Habit Selection (Step 5)
STATE: Subcategory chosen. Habits database queried. Relevant habits displayed.
BEHAVIOR: Vapi agent presents habits from the database. Encourage 'doable, not heroic.' Accept 1-3 habits. If they want more than 3, gently redirect. Custom habits allowed - capture name via voice/text.
MINIMUM: At least 1 habit required before proceeding. Block Continue if 0 selected.
DO NOT: Let them skip with 0 habits. Discourage custom habits. Make more than 3 feel like failure.
NEXT: Habits selected -> ONBOARD-BEGINNER-04 (configure each habit).

**Voice Content:**

Here are a few habits that really help with this. Pick what feels doable. Not heroic. Not impressive. Doable. Because one habit done consistently beats five that don't stick. You can also create your own if none of these fit.

**Voice Instructions:**

[Vapi agent live TTS, agent session continues from ONBOARD-01]

**Voice Notes:**

Vapi agent for MVP. Habit response MP3s in Phase 2. Auto-navigates per UX-03.

**Expected user response:**

SELECT: 'No screens after 10' / 'The first one'
CUSTOM: 'None of these fit' / 'I have my own idea'
TOO MANY: 'All of them'

OR Tap: Select 1-3 -> Continue

**AI Response:**

SELECTED: 'Solid. [Specific comment]. Let's set it up.'
CUSTOM: 'No problem. Tell me the habit and I'll set it up.'
TOO MANY: 'I'd recommend starting with 2-3. Which ones feel most important?'

**System Action:**

1. Save selected habit IDs
2. If custom: capture name via voice/text
3. Validate 1-3 selected
4. Navigate to ONBOARD-BEGINNER-04
5. Log PostHog: select_habit {habit_names[], count}

**Edge Cases:**

ZERO SELECTED: 'We need at least one habit to get started.' Block Continue.
User overwhelmed: 'Just pick one. One is a perfect start.'

**Notes:**

1-3 recommended. At least 1 required.

---

### `ONBOARD-BEGINNER-04` — Habit Configuration

**Name:** Habit Configuration · **Phase:** Phase 1 · **Active:** Planned · **Type:** LLM-active · **Row Type:** Screen · **Route:** /onboard/06 · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 3 · **UX Rules:** UX-02, UX-03, UX-09, UX-13, UX-14 · **PostHog:** complete_onboarding_step, configure_habit_onboarding, llm_call · **session_log:** navigate, voice_started, voice_ended, form_submit, llm_call · **Tasks:** P1-24, P1-42 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1219-5237 · **Figma node:** 1219:5237

**Screen text (Figma):**

What specifically do you
want to improve?
No Screens after 10 PM
Customize your habit
Choose one option.
When?
:
PM
No screens after 10 PM
Schedule:
Weekday
Fall asleep earlier
How often?
Start wind-down by 10 PM
S
M
T
W
T
F
S
Wake up earlier
Reminder
Sleep more consistently
Sleep more deeply
Continue

**AI Context Block:**

SCREEN: Habit Configuration (Step 6)
STATE: User selected habits. Now configuring each one: time, frequency, reminder.
BEHAVIOR: Vapi agent asks when and how often for each habit. Accept voice or taps. Parse: 'every day at 9:30 PM with a reminder' = all 3 fields. If partial, ask for what's missing specifically. Auto-fill UI in real-time.
DEFAULTS: Sleep habits = 9-10 PM. Morning habits = 7-8 AM. Exercise = 6-7 PM.
PARSING: 'Every day' = all 7. 'Weekdays' = M-F. 'Before bed' = ask specific time.
DO NOT: Accept ambiguous times without clarifying. Skip reminders question.
NEXT: Last habit configured -> ONBOARD-BEGINNER-06 (review).

**Voice Content:**

When do you want to do [habit name], and how often? You can say something like 'every night at 9:30' or set it up on screen.

**Voice Instructions:**

[Vapi agent live TTS, agent session continues from ONBOARD-01]

**Voice Notes:**

Vapi agent parses schedule. Auto-fills form. Loops per habit. Auto-advances per UX-03.

**Expected user response:**

FULL: 'Every day at 9:30 PM with a reminder'
PARTIAL: 'Every day' (missing time) / 'At 9 PM' (missing frequency)
'Weekdays' / 'Before bed' / 'Mornings'

**AI Response:**

FULL: 'Done - every day at 9:30 PM, with a reminder.'
MISSING TIME: 'Every day works. What time specifically?'
MISSING FREQUENCY: '9 PM, got it. And how often?'

**System Action:**

1. Parse voice: extract {frequency, time, reminder}
2. Auto-fill UI in real-time
3. Save to Supabase habits
4. If more habits: loop ONBOARD-BEGINNER-04
5. If last habit: navigate to ONBOARD-BEGINNER-06
6. Log PostHog: configure_habit

**Edge Cases:**

'Before bed': 'What time is that for you?'
'I'm not sure': Use reasonable default (sleep=9PM, morning=7AM)
USER CHANGES MIND: 'Actually make that 10 PM' - 'Updated to 10 PM.'

**Notes:**

Voice auto-fills form in real-time.

**Yonas:**

In the figma design i have seen this page is a bottom sheet does that mean its optional close it and skip this step

---

### `ONBOARD-BEGINNER-06` — Review Habits

**Name:** Review Habits · **Phase:** Phase 1 · **Active:** Planned · **Type:** LLM-active · **Row Type:** Screen · **Route:** /onboard/07 · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 3 · **UX Rules:** UX-02, UX-03, UX-09, UX-13, UX-14 · **PostHog:** complete_onboarding_step, llm_call · **session_log:** navigate, voice_started, voice_ended, form_submit, llm_call · **Tasks:** P1-24, P1-42 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1219-5537 · **Figma node:** 1219:5537

**Screen text (Figma):**

Here's your plan so far
No Screens after 10 PM
Schedule:
Edit
S
M
T
W
T
F
S
Start wind-down by 10 PM
Schedule:
Edit
S
M
T
W
T
F
S
Tap Edit to change the schedule for any habit.
Continue

**AI Context Block:**

SCREEN: Review Habits
STATE: All habits configured. User reviewing before moving to reflection setup.
BEHAVIOR: Vapi agent displays all configured habits. Asks if everything looks right. Handle edits via voice one at a time. Allow adding more habits here too. Keep this screen fast - momentum matters.
IF ADD: 'What habit would you like to add?' -> collect name, time, frequency, reminder.
DO NOT: Slow down. Add unnecessary commentary. Make them second-guess.
NEXT: Confirmed -> ONBOARD-BEGINNER-07 (reflection setup).

**Voice Content:**

Here's what we've set up. Does everything feel right, or should we tweak something?

**Voice Instructions:**

[Vapi agent live TTS, agent session continues from ONBOARD-01]

**Voice Notes:**

Vapi agent. 'Looks good' auto-navigates per UX-03.

**Expected user response:**

CONFIRM: 'Looks good' / 'Perfect'
EDIT: 'Change [habit] to [time]'
ADD: 'I want to add another habit'

**AI Response:**

CONFIRM: 'Locked in.'
EDIT: 'Updated. How's that now?'
ADD: 'Sure - what habit would you like to add?'

**System Action:**

1. Display habits from state
2. On confirm: navigate to ONBOARD-BEGINNER-07
3. Log PostHog: confirm_habits {habit_count, edits_made}

**Edge Cases:**

User deletes a habit: 'Removed. Anything else?'
User adds here: mini habit creation flow.

**Notes:**

Quick screen. Momentum matters.

**Yonas:**

Could you please explaine the quick screen and momentum ?

---

### `ONBOARD-BEGINNER-07` — Journal Setup

**Name:** Journal Setup · **Phase:** Phase 1 · **Active:** Planned · **Type:** LLM-active · **Row Type:** Screen · **Route:** /onboard/08 · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 3 · **UX Rules:** UX-02, UX-03, UX-09, UX-13, UX-14 · **PostHog:** complete_onboarding_step, configure_journal_onboarding, llm_call · **session_log:** navigate, voice_started, voice_ended, form_submit, llm_call · **Tasks:** P1-24, P1-42 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1219-5846 · **Figma node:** 1219:5846

**Screen text (Figma):**

Your evening reflection
Your evening check-in ends with a daily reflection. Choose how you want to do it.
✨
Daily Reflection
Powered by AI Voice-to-Text. Just talk,
we'll type.
You'll answer 3 quick questions:
What am I proud of today?
What do I forgive myself for today?
What am I grateful for today?
Optional: Create My Own Prompts
Schedule:
S
M
T
W
T
F
S
Continue

**AI Context Block:**

SCREEN: Evening Reflection Setup (MANDATORY)
STATE: Habits confirmed. This is the last setup step before the final plan.
BEHAVIOR: Vapi agent presents reflection options. Reflection is mandatory. The user picks ONE of three styles:
1. Guided prompts (recommended): 'I'll ask you three simple questions each evening. You just answer.' Questions: What are you proud of? What do you forgive yourself for? What are you grateful for?
2. Custom prompts: 'Write your own questions. I'll ask them each evening.'
3. Freeform: 'No questions. Just talk about your day however you want.'
FRAMING: 'Two minutes at the end of your day. It helps you notice what's working, let go of what isn't, and build self-awareness that compounds over time. Most people feel a difference within a week or two.'
DO NOT: Present reflection as optional. Use the word 'journal' (say 'reflection'). Make it feel like homework. Skip the why.
NEXT: Style chosen -> ONBOARD-BEGINNER-10 (final plan). SUPABASE: reflection_style = 'guided' | 'custom' | 'freeform'. journal_configured = true always.

**Voice Content:**

Now for your evening reflection. Every evening after your habit review, you'll take a couple of minutes to reflect on your day. Choose how.

Option one: I ask you three questions each evening. What you're proud of, what you forgive yourself for, and what you're grateful for. You just answer.

Option two: you write your own questions. I'll ask them each evening.

Option three: no questions at all. Just talk about your day however you want.

Which sounds right?

**Voice Instructions:**

[Vapi agent live TTS, agent session continues from ONBOARD-01]

**Voice Notes:**

Vapi agent. 'Yeah'/'skip' auto-navigates per UX-03.

**Expected user response:**

GUIDED: 'The first one' / 'Guided' / 'Three questions' / 'The recommended one'
CUSTOM: 'Custom' / 'My own' / 'I want to write my own'
FREEFORM: 'Freeform' / 'Just talk' / 'No questions' / 'The third one'
QUESTION: 'What are the three questions?' / 'Can I change later?'

OR Tap: Select option

**AI Response:**

GUIDED: 'Good choice. Those three questions are simple but they change how you process your day. When do you want your evening check-in?'
CUSTOM: 'Nice. Add at least one question now, and you can always change them later in Settings. What's your first question?'
FREEFORM: 'No structure, just you. I'll capture everything. When do you want your evening check-in?'
WHAT ARE THE QUESTIONS: 'What am I proud of today? What do I forgive myself for today? What am I grateful for today? Three questions, two minutes.'
CAN I CHANGE: 'Anytime in Settings.'

**System Action:**

1. Save reflection_style to user_profile: 'guided' | 'custom' | 'freeform'
2. If custom: collect prompts via voice/text
3. Save evening check-in time
4. Set journal_configured = true
5. Navigate to ONBOARD-BEGINNER-10
6. Log PostHog: configure_reflection

**Edge Cases:**

User asks 'Do I have to?': 'Reflection is part of the experience - it's where the real change happens. Pick whichever feels easiest to start.'

**Notes:**

Reflection is mandatory. Three styles. 'Reflection' not 'journal'.

**Mint:**

What we've right here doesn't match the figma design, need a clariy on it ?

---

### `STARTING-PLAN` — Plan Summary + Start

**Name:** Plan Summary + Start · **Phase:** Phase 1 · **Active:** Planned · **Type:** LLM-active · **Row Type:** Screen · **Route:** /onboard/09 · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 3 · **UX Rules:** UX-02, UX-03, UX-09, UX-13, UX-14, UX-20 · **PostHog:** complete_onboarding, llm_call · **session_log:** navigate, voice_started, voice_ended, onboarding_completed, llm_call · **Tasks:** P1-25, P1-42 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1219-6053 · **Figma node:** 1219:6053

**Screen text (Figma):**

Your starting plan
Your system is ready. Morning check-in, habits, and evening reflection.
Edit
Habit
No screens after 10 PM
Cadence: Weekdays • Rule: Yes if no
recreational screen use after 10 PM
Edit
Habit
Start wind-down by 10 PM
Cadence: Daily • Rule: Yes if wind-
down routine started by 10 PM
Edit
Journal
Daily reflection
Cadence: Daily • Rule: Answer 3 quick
prompts
Start Plan

**AI Context Block:**

SCREEN: Final Plan + Founding User Moment
STATE: Everything configured. This is the emotional peak before entering the app.
BEHAVIOR: Vapi agent shows the complete plan: morning check-in, habits, evening check-in with reflection. Delivers the founding user message: 'As one of the first 50 people to use Guided Growth...' This should feel like a moment, not a summary.
GOAL: Ownership transfer. 'This is your system now.' Make them feel invested.
DO NOT: Rush the founding user message. Make it generic. Skip the emotional beat.
NEXT: 'Start plan' -> activate everything, navigate to HOME-FIRST.

**Voice Content:**

Here's your starting plan. It's simple - and that's on purpose. This is your foundation. As you show up, we'll grow it together.

And [Name] - as one of the first 50 people to use Guided Growth, I want you to know: we're really proud of what we've built, and it's going to get so much better. Your experience here, your feedback - it shapes where this goes. Our goal is to contribute to your life. So thank you for being here.

Ready?

**Voice Instructions:**

[Vapi agent live TTS, agent session continues from ONBOARD-01]

**Voice Notes:**

Vapi agent. 'Let's go' completes onboarding, auto-navigates to Home per UX-03.

**Expected user response:**

READY: 'Let's go' / 'Yes' / 'Ready' / 'Start'
EDIT: 'Actually, change...' / 'Let me fix something' / 'Edit'

OR Tap: Start plan / Edit plan

**AI Response:**

READY: 'You're in, [Name]. Your first check-in is on the home screen. Talk to you soon.'
EDIT: 'No problem. What do you want to change?' -> navigate to edit flow

**System Action:**

1. On 'Start plan': onboarding_state = 'complete', onboarding_completed_at = now()
2. Activate all habits (status = 'active')
3. Activate journal if configured
4. Schedule morning + evening check-in reminders
5. Terminate Vapi session
6. Navigate to Home (first visit - see HOME-FIRST)
7. Log PostHog: complete_onboarding {path: 'beginner', habit_count, journal_configured, duration_seconds}

**Edge Cases:**

If user says something emotional like 'I'm excited' or 'I hope this works': AI: 'It will. Show up, and it will.'
If user seems hesitant: 'You're ready. We'll take it one day at a time.'

**Notes:**

Founding user message comes HERE - emotional peak before entering app.

---

### `ONBOARD-ADVANCED-03` — Advanced - Voice Journal Intro

**Name:** Advanced - Voice Journal Intro · **Phase:** Phase 1 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /onboard/advanced · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 3 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1355-6205

**Screen text (Figma):**

(see screen text — Figma)

**AI Context Block:**

SCREEN: Voice Journal Intro (advanced path step 3)
STATE: User finished freeform habit setup. Now introducing the daily reflection / journaling feature.
BEHAVIOR: Vapi agent introduces the AI Voice Journal: 'You'll have an evening reflection where you can talk freely or follow guided prompts. Your voice gets transcribed and the AI helps you process the day.' User taps Continue.
DO NOT: Force a journal mode choice yet (next screen does that). Make the user feel they MUST journal.
NEXT: ONBOARD-ADVANCED-04 (journal mode choice).

**Voice Content:**

Meet your AI Voice Journal. We'll turn your voice into text and learn from it to personalize your coaching.

**Voice Instructions:**

[Vapi agent live TTS, ~6 sec, then user taps Continue]

**Voice Notes:**

Vapi agent live TTS

**Expected user response:**

Tap: Continue.

**AI Response:**

User taps Continue. No verbal response expected.

**System Action:**

1. Display intro screen with daily reflection card preview
2. Vapi agent speaks intro text
3. User taps Continue → ONBOARD-ADVANCED-04

**Edge Cases:**

User taps before audio finishes: stop audio, advance.

**Notes:**

Companion to ONBOARD-BEGINNER-07 (which has the same content for the beginner path).

---

### `ONBOARD-ADVANCED-04` — Advanced - Journal Mode Choice

**Name:** Advanced - Journal Mode Choice · **Phase:** Phase 1 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /onboard/advanced · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 3 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1355-6603

**Screen text (Figma):**

(see screen text — Figma)

**AI Context Block:**

SCREEN: Journal Mode Choice (advanced path step 4)
STATE: User has been introduced to journaling. Pick mode: Freeform OR Custom Prompts.
BEHAVIOR: Two options. FREEFORM = open mic, AI listens to whatever user shares, no prompts. CUSTOM PROMPTS = user defines their own 3 prompts (or starts with default 'I am proud / I forgive / I am grateful').
DO NOT: Force one option. Show GUIDED option (that's the beginner path). Force prompts to be set now if they pick Custom.
NEXT: ONBOARD-ADVANCED-05 (starting plan summary).

**Voice Content:**

How do you want to journal? You can talk freely or use custom prompts you set.

**Voice Instructions:**

[Vapi agent live TTS]

**Voice Notes:**

Vapi agent live TTS

**Expected user response:**

VOICE: 'I'll just talk' / 'Custom prompts'.
TAP: Freeform Journaling card / Custom Prompts card.

**AI Response:**

FREEFORM picked: 'Got it. Just open the mic and talk.' CUSTOM picked: 'Got it. You can set the prompts now or later.'

**System Action:**

1. Display two cards (Freeform / Custom Prompts)
2. User picks one
3. Save user_profile.reflection_style
4. Navigate to ONBOARD-ADVANCED-05

**Edge Cases:**

User picks Custom but doesn't set prompts: skip prompt entry, default to first 3 (proud/forgive/grateful), let user edit later in SETTINGS.

**Notes:**

Companion to ONBOARD-BEGINNER-08 (beginner path equivalent).

---

### `ONBOARD-ADVANCED-05` — Advanced - Your Starting Plan

**Name:** Advanced - Your Starting Plan · **Phase:** Phase 1 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /onboard/advanced · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 3 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1355-6026

**Screen text (Figma):**

(see screen text — Figma)

**AI Context Block:**

SCREEN: Starting Plan (advanced path final step)
STATE: User finished advanced onboarding (freeform goals + journaling setup). Showing summary of what was created.
BEHAVIOR: Display: habits AI organized for them, daily reflection schedule, schedule defaults. Vapi agent: 'Here's what we've got. You can always tweak this later.' User taps 'Start Plan' to enter HOME-DEFAULT.
DO NOT: Push edits now. Make user feel locked in.
NEXT: HOME-DEFAULT (start the app).

**Voice Content:**

Here's what we've got. You can always tweak this later. Ready to start your plan?

**Voice Instructions:**

[Vapi agent live TTS, ~6 sec]

**Voice Notes:**

Vapi agent live TTS

**Expected user response:**

Tap: Start Plan.

**AI Response:**

Welcome closing: 'Let's go.' Then auto-navigate.

**System Action:**

1. Display plan summary (habits + reflection schedule)
2. Vapi agent speaks closing line
3. User taps Start Plan
4. Set onboarding_completed = true in Supabase
5. Navigate to HOME-DEFAULT

**Edge Cases:**

User taps before audio finishes: skip audio, advance. Audio replay link in case user missed it.

**Notes:**

Companion to ONBOARD-BEGINNER-10 (final summary for beginner path).

---

### `ONBOARD-BEGINNER-05` — Beginner - Configure Habit #2

**Name:** Beginner - Configure Habit #2 · **Phase:** Phase 1 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /onboard/beginner/05 · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 4 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1219-5387 · **Figma node:** 1219:5387

**Screen text (Figma):**

What specifically do you
want to improve?
Start wind-down by 10 PM
Customize your habit
Choose one option.
When?
:
PM
No screens after 10 PM
Schedule:
Weekday
Fall asleep earlier
How often?
Start wind-down by 10 PM
S
M
T
W
T
F
S
Wake up earlier
Reminder
Sleep more consistently
Sleep more deeply
Continue

**AI Context Block:**

SCREEN: Configure 2nd habit (beginner path step 5)
STATE: User configured habit #1 in BEGINNER-04. Now configuring habit #2 if they picked 2 habits.
BEHAVIOR: Same as BEGINNER-04 — bottom-sheet modal asks WHEN, HOW OFTEN, REMINDERS for habit #2. Different example habit shown.
NEXT: BEGINNER-06 (review).

**Voice Content:**

And when do you want to do [habit name]?

**Voice Instructions:**

[Vapi live TTS]

**Voice Notes:**

Vapi live TTS

**Expected user response:**

Voice or tap configures time/frequency/reminder.

**AI Response:**

Confirms config, advances.

**System Action:**

Same as BEGINNER-04, just for the 2nd selected habit.

**Edge Cases:**

Skipped if user only picked 1 habit at BEGINNER-03.

**Notes:**

Companion to BEGINNER-04 — same screen, different habit data.

---

### `ONBOARD-BEGINNER-08` — Beginner - Journal Mode Choice

**Name:** Beginner - Journal Mode Choice · **Phase:** Phase 1 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /onboard/beginner/08 · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 4 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1219-5936 · **Figma node:** 1219:5936

**Screen text (Figma):**

How do you want to reflect?
Choose guided questions, create your own, or just talk freely.
Freeform
No set questions. Just talk about whatever is on your mind.
Custom Prompts
Add at least 1 prompt:
What did I learn today?
Type your next prompt here...
Or just tap the mic and say your prompts out loud. We'll
list them for you.
Continue

**AI Context Block:**

SCREEN: Journal mode choice (beginner path step 8)
STATE: After habit configuration. Now picking how the user wants to journal.
BEHAVIOR: Two-card choice: GUIDED (default 3 prompts: I am proud / I forgive / I am grateful) or CUSTOM PROMPTS (user defines own).
NEXT: BEGINNER-09 (check-in schedule).

**Voice Content:**

How do you want to reflect each day? You can pick guided or set your own prompts.

**Voice Instructions:**

[Vapi live TTS]

**Voice Notes:**

Vapi live TTS

**Expected user response:**

VOICE/TAP: Guided / Custom Prompts.

**AI Response:**

Save user_profile.reflection_style. Advance.

**System Action:**

1. Display two-card choice
2. User picks one
3. Save reflection_style
4. Navigate to BEGINNER-09

**Edge Cases:**

Custom picked but no prompts: default to (I am proud, I forgive, I am grateful) — user can edit later.

**Notes:**

Companion to ONBOARD-ADVANCED-04.

---

### `ONBOARD-BEGINNER-09` — Beginner - Check-in Schedule

**Name:** Beginner - Check-in Schedule · **Phase:** Phase 1 · **Active:** Yes · **Type:** LLM-active · **Row Type:** Screen · **Route:** /onboard/beginner/09 · **Voice Engine:** Vapi · **Voice Mode:** Generative · **Stage:** Stage 4 · **Figma:** https://www.figma.com/design/XwaXflQLtEzD4jpZX4dBWr/Habit---Journal-Apps?node-id=1219-6122 · **Figma node:** 1219:6122

**Screen text (Figma):**

When would you like to do your quick check-ins
We'll use this to optimize your smart plan.
Morning check in
Reminder
Night check in
Reminder
We recommend doing your check-in 15
minutes after waking up and 15 minutes
before bedtime.
Continue

**AI Context Block:**

SCREEN: Check-in schedule (beginner path step 9)
STATE: Reflection mode chosen. Now setting WHEN to do morning + evening check-ins.
BEHAVIOR: Two time pickers: Morning check-in (default 7am) and Night check-in (default 10pm). Reminder toggles for each. Optional — user can skip and configure later in Settings.
NEXT: BEGINNER-10 (starting plan).

**Voice Content:**

When would you like to do your quick check-ins? You can change this anytime.

**Voice Instructions:**

[Vapi live TTS]

**Voice Notes:**

Vapi live TTS

**Expected user response:**

Tap time pickers to adjust. Toggle reminders.

**AI Response:**

Confirm and advance.

**System Action:**

1. Display morning + night check-in time pickers + reminders
2. User adjusts or accepts defaults
3. Save to user_profile.checkin_schedule
4. Navigate to BEGINNER-10

**Edge Cases:**

User skips: keep defaults (7am morning, 10pm evening, reminders ON).

**Notes:**

Replaces the legacy REMIND-01 row from older spec.

---

_Last refreshed: 2026-05-11_