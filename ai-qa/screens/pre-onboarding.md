---
domain: contexts
title: Pre-onboarding screens (SPLASH → MIC-PERMISSION)
primary:
  file: src/generated/screen_contexts.json
  symbol: (JSON bundle)
related:
  - file: api/_lib/llm/buildSystemPrompt.ts
    symbol: buildSystemPromptForRequest
  - file: api/_lib/llm/stripForwardPointers.ts
    symbol: stripForwardPointers
last_verified: 2026-06-09
---

# Pre-onboarding screens (SPLASH → MIC-PERMISSION)

Verbatim `context_block` text for each screen in this group — the **exact text the AI sees** as Layer 7 (ACTIVE SCREEN UPDATE) of its system prompt for Direct-LLM paths (after `stripForwardPointers` strips the `--- SUPPLEMENTARY ---` tail and forward pointers).

Vapi (Path 1) receives the **raw, unstripped** version of each block — including everything after `--- SUPPLEMENTARY ---`.

Source: `src/generated/screen_contexts.json` (bundle version 2026-05-20). Master Sheet → Supabase → bundle (byte-identical).

---

## SPLASH

**Screen name:** Splash / Loading screen · **Route:** `/splash` · **Bytes:** 709

```
SCREEN_ID: SPLASH
SCREEN_NAME: Splash / Loading screen
ROUTE: /

SCREEN: Splash (loading)
STATE: App is loading. Brief loading screen with logo.
BEHAVIOR: Silent. Display logo while app initializes. Once loaded, auto-navigate to WELCOME.
DO NOT: Play any voice. Show auth buttons (those are on WELCOME).
NEXT: Auto-navigate to WELCOME when app is ready.


--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Silent]

EXPECTED USER RESPONSE:
None. Screen auto-transitions.

AI RESPONSE PATTERN:
-

SYSTEM ACTION:
1. Display logo
2. Initialize app (Supabase, Cartesia)
3. Auto-navigate to WELCOME

EDGE CASES:
Slow connection: show loading indicator. Don't hang on splash.

NOTES:
Brief loading screen. 1-2 seconds max.
```

---

## WELCOME

**Screen name:** Welcome (voice hook) · **Route:** `/welcome` · **Bytes:** 1860

```
SCREEN_ID: WELCOME
SCREEN_NAME: Welcome (voice hook)
ROUTE: /welcome

SCREEN: Welcome (first open, voice hook)
STATE: App has finished loading. User sees the welcome screen for the first time. No account yet. No mic access.
BEHAVIOR: Auto-play the welcome hook (~8 sec) via Vapi agent live TTS in cloned voice (NOT a pre-recorded MP3 - this changed in v2 plan). Do NOT request mic. The voice plays one-way - this is a broadcast, not a conversation. Stop audio (terminate Vapi session) immediately if user taps any auth button.
GOAL: Hook the user with the surprise of voice. Create curiosity. Drive signup.
DO NOT: Ask questions. Wait for voice input. Play anything after the hook ends.
NEXT: Any auth button -> AUTH-SIGNUP or AUTH-LOGIN. After auth -> VOICE-PREFERENCE (voice preference).

--- SUPPLEMENTARY ---

EXPECTED USER RESPONSE:
Tap: Continue with Apple
Tap: Continue with Google
Tap: Sign up with email
Tap: Log In

No voice input expected here.

AI RESPONSE PATTERN:
-

SYSTEM ACTION:
1. On screen load: connect to Vapi agent and play welcome hook (~8 sec) via live TTS in cloned voice
2. On any auth button tap: terminate Vapi session immediately
3. Route to OAuth flow or email signup form
4. On OAuth success: extract name (Google: given_name, Apple: givenName)
5. Save user_profile {email, name, auth_method}
6. Set onboarding_state = 'welcome'
7. Navigate to VOICE-PREFERENCE
8. Set first_open = true in localStorage

EDGE CASES:
Audio MUST complete or stop before OAuth redirect.
RETURNING VISIT (not logged in, already heard hook): No voice. Skip Vapi connection. Normal auth flow. Check localStorage first_open flag.
RETURN FROM 'COME BACK LATER': Short voice via voice orchestrator: 'Hey - you're back. Ready to set up?' Then normal auth or skip to VOICE-PREFERENCE if already authed.

NOTES:
~8 sec. Hook + coach intro + reason to sign up.
```

---

## AUTH-SIGNUP

**Screen name:** Create Account (Email signup) · **Route:** `/signup` · **Bytes:** 974

```
SCREEN_ID: AUTH-SIGNUP
SCREEN_NAME: Create Account (Email signup)
ROUTE: /auth/signup

SCREEN: Create Account (email signup)
STATE: No voice. No mic. Pure form.
BEHAVIOR: Silent. No coach presence on this screen. Let them sign up quickly.
NEXT: On signup success -> VOICE-PREFERENCE.

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[No voice on this screen]

EXPECTED USER RESPONSE:
Type: email + password
Tap: Sign Up
Tap: Log In (redirect)

AI RESPONSE PATTERN:
-

SYSTEM ACTION:
1. Validate email format, password strength (min 8 chars)
2. Supabase auth.signUp()
3. No name from email signup
4. Set onboarding_state = 'welcome'
5. Navigate to VOICE-PREFERENCE (voice preference)

EDGE CASES:
Weak password: inline error 'Password needs at least 8 characters.'
Email exists: 'This email already has an account. Try logging in.'
Invalid email: 'Please enter a valid email address.'
Network error: 'Connection issue. Check your internet and try again.'

NOTES:
Fast, functional.
```

---

## VOICE-PREFERENCE

**Screen name:** Voice/Screen Preference · **Route:** `/onboarding/voice-preference` · **Bytes:** 2531

```
SCREEN_ID: VOICE-PREFERENCE
SCREEN_NAME: Voice/Screen Preference
ROUTE: /onboard/preference

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

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Vapi agent speaks one-way - like a broadcast. Mic is NOT active yet on this screen.]
[User responds by TAP only. Voice input not available.]
[~6 sec live TTS in cloned voice]

EXPECTED USER RESPONSE:
Tap: 'Talk to me' (primary button)
Tap: 'Screen is fine' (secondary button)

Note: Mic is NOT active on this screen. User responds by tap only. If no response after 10 seconds: default to 'voice', auto-navigate.

AI RESPONSE PATTERN:
TALK: [Transition to MIC-PERMISSION for mic permission]

SCREEN: 'No problem. I'll write everything on screen. You can always switch to voice later in Settings.'

SYSTEM ACTION:
1. On screen load: connect to Vapi, agent speaks 'Can I talk?' prompt via live TTS
2. Save user_profile.ai_output_mode:
   - 'Talk to me' -> 'voice'
   - 'Screen is fine' -> 'screen'
   - Default (no response/timeout) -> 'voice'
3. Terminate Vapi session
4. Navigate to MIC-PERMISSION (all paths)
5. Log PostHog: voice_preference {choice, input_method}

EDGE CASES:
User doesn't respond (silence): After 10 seconds, default to 'voice' and navigate to MIC-PERMISSION.
User says something unclear: Show the two buttons again.
User says 'What's the difference?': 'If I talk, you'll hear my voice. If screen, I'll write everything as text. Either way, you can always talk to me using the mic button.'

NOTES:
NEW screen. Appears after auth, before welcome. Default = 'voice' if user doesn't choose. Two independent settings: ai_output_mode (voice/screen) and mic_permission (on/off).
```

---

## MIC-PERMISSION

**Screen name:** Mic Permission · **Route:** `/onboarding/mic-permission` · **Bytes:** 2568

```
SCREEN_ID: MIC-PERMISSION
SCREEN_NAME: Mic Permission
ROUTE: /onboard/mic

SCREEN: Mic Permission
STATE: User chose voice preference (or default). Now requesting mic access.
BEHAVIOR: Vapi agent speaks pre-permission explanation live (NOT a pre-recorded MP3). Then button triggers the browser prompt. This is the single biggest friction point. The explanation must earn the permission: 'I always want to give you the option to talk to me.'
IF GRANTED: Brief confirmation via voice orchestrator. Animate the mic icon. Move to welcome. IF DENIED: Graceful fallback via voice orchestrator. 'No problem. You can always type.' No dead end.
GOAL: Get mic access without pressure. Make denied feel OK.
DO NOT: Fire the browser prompt without explanation. Block the flow on denial. Guilt.
NEXT: Regardless of result -> POST-AUTH-01 [DEPRECATED] (welcome).

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Pre-permission text spoken via Vapi live TTS (or displays as text based on ai_output_mode)]
[Button tap triggers browser permission prompt]
[After granted: agent says 'Got it. You can talk to me anytime now.' via live TTS]
[After denied: agent says 'No problem. You can always type instead. Enable mic in browser settings.' via live TTS]
[If mic already granted: skip this screen entirely]

EXPECTED USER RESPONSE:
ALLOW: Tap 'Allow microphone' -> browser permission prompt -> Grant
DENY: Browser prompt -> Deny / Dismiss
ALREADY GRANTED: Skip this screen entirely

AI RESPONSE PATTERN:
GRANTED: 'Got it. You can talk to me anytime now.'
DENIED: 'No problem. You can always type instead. If you change your mind, enable it in your browser settings.'
DISMISSED: Same as denied.

SYSTEM ACTION:
1. On screen load: connect to Vapi, agent speaks pre-permission via live TTS
2. Button triggers navigator.mediaDevices.getUserMedia({audio: true})
3. On grant: set mic_permission = true, agent confirms via voice orchestrator
4. On deny: set mic_permission = false, agent reassures via voice orchestrator
5. Terminate Vapi session
6. Navigate to POST-AUTH-01 [DEPRECATED]
7. Log PostHog: mic_permission {result: granted | denied | dismissed}

EDGE CASES:
Browser blocks: explain how to enable in browser settings. User dismisses without choice: treat as denied.

NOTES:
Single biggest friction point in the funnel. AI-text-mode variant (MIC-PERMISSION--AI-TEXT-MODE, Figma node 1233:3706) uses identical content but routes to ONBOARD-01--FORM instead of ONBOARD-01--VOICE-STEP-1 on confirm. Per UX-24, the orb dual-button toggle flips between this voice variant and the text variant.
```

---
