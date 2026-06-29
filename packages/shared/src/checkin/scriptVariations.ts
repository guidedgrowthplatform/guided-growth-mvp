// Scripted check-in lines the coach says verbatim. The text pool comes from the
// Master Sheet "Voice Scripts" tab via the committed CHECKIN_SCRIPT_VARIANTS artifact
// (regenerate with `npm run checkin:bundle`), overlaid on the hand-authored fallback
// below so the coach is never silent if a stage is missing from the sheet. One variation
// is picked at random per call.
import { CHECKIN_SCRIPT_VARIANTS } from '../generated/checkin_scripts';

export type CheckinStageKey =
  | 'morning_greeting'
  | 'morning_state_prompt'
  | 'morning_wrap'
  | 'evening_greeting_habits'
  | 'evening_habit_prompt'
  | 'reflection_transition'
  | 'reflection_proud'
  | 'reflection_forgive'
  | 'reflection_grateful'
  | 'evening_wrap'
  | 'are_you_done'
  | 'acknowledgment';

// Hand-authored fallback pool (never-blank): used for any stage the synced artifact
// does not provide. The live CHECKIN_SCRIPTS below overlays the sheet content on this.
const FALLBACK_SCRIPTS: Record<CheckinStageKey, readonly string[]> = {
  morning_greeting: [
    'Good morning. Ready to check in?',
    "Hey. Let's start the day.",
    'Morning. Good to have you here.',
    "Hey, good morning. Let's take a quick look at how you're doing.",
    "Good morning. Take a breath, we'll keep this short.",
    'Morning. Glad you showed up.',
    "Hey. Let's see where you're starting from today.",
  ],
  morning_state_prompt: [
    'How are you feeling this morning? Mood, energy, sleep, any stress on your mind. Tap what fits or just tell me.',
    "Let's check in on the basics. How's your mood, energy, sleep, and any stress? Tap the items on screen or just say it out loud.",
    'Before we start, how are you landing today? You can tap mood, stress, energy, and sleep right there, or just tell me in your own words.',
    "How'd you sleep? And how are you feeling overall, mood, energy, stress? Tap what you see or just say it.",
    'Quick read on the morning. Mood, energy, sleep quality, stress level. Tap each one or just talk me through it.',
    "How are you doing right now? Check in on your mood, energy, sleep, and any stress. Tap the items or just say what's true.",
    'Tell me about this morning. Mood, energy, how you slept, anything sitting on you. You can tap or just talk.',
  ],
  morning_wrap: [
    "That's a good start. Go make it a good one.",
    "You're set. Have a good day.",
    'Nice. Carry that into your day.',
    'Good check-in. Go get the day.',
    "That's it for now. Make today count.",
  ],
  evening_greeting_habits: [
    'Hey, good evening. Here are your habits for today. How did the day go?',
    "Welcome back. Your habits from today are on screen. How'd it go?",
    'Evening. Here are the habits you set for yourself today. Tell me how it went.',
    "Hey. Here's your habit list for today. How was your day?",
    'Good evening. Take a look at your habits here. How are you feeling about how today went?',
    'Hey, you made it to the end of the day. Here are your habits. How did things go?',
    "Evening check-in. Your habits are right there. How'd today treat you?",
  ],
  evening_habit_prompt: [
    'Go ahead and tap the ones you did. Or just tell me.',
    "Tap each habit to mark it, or say it out loud and I'll track it.",
    'Which ones did you get to today? Tap them or just tell me.',
    "Mark off what you did, tap right on the screen. Or if it's easier, just tell me.",
    'Check off what you completed. Tap each one, or just say which ones you did.',
    'Let me know what you got to today. Tap the habits or just tell me out loud.',
    "Go through your list and tap what happened. Or talk me through it, whichever's easier.",
  ],
  reflection_transition: [
    "Good. Now let's take a moment to reflect on the day itself.",
    "Okay. Let's sit with the day for a minute.",
    "Now let's slow down and look at the day more closely.",
    "Nice. Let's move into the reflection part now.",
    'Alright. A few questions to close the day with.',
    "Let's take a breath and reflect on today before we close out.",
    'Good. Time to look back at the day.',
  ],
  reflection_proud: ['What are you proud of today?'],
  reflection_forgive: ['What do you forgive yourself for today?'],
  reflection_grateful: ['What are you grateful for today?'],
  evening_wrap: [
    "That's it for tonight. Sleep well.",
    'Nice work showing up. See you in the morning.',
    "Good. Rest up. We'll start fresh tomorrow.",
    "That's a wrap for today. Take care of yourself tonight.",
    'Good night. See you when you wake up.',
  ],
  are_you_done: [
    'Looks like there are a few items left. Want to add anything, or should we move on?',
    'You got some of it. Anything else you want to share, or are you good?',
    'Want to fill in the rest, or leave it here for now?',
    "There's a bit more on the list. Up to you if you want to go through it or move on.",
    'You covered some of it. Anything else on your mind, or should we continue?',
    'A few items are still there. Add more if it feels right, or we can move along.',
  ],
  acknowledgment: [
    'Got it.',
    'Thanks for that.',
    'Okay.',
    'Makes sense.',
    'Good.',
    'Alright.',
    'Good to know.',
    'Okay, good.',
    'Cool.',
  ],
};

// Live pool: synced Sheet variations overlaid on the fallback. A stage absent or empty
// in the generated artifact falls back to its hand-authored line(s).
export const CHECKIN_SCRIPTS = Object.fromEntries(
  (Object.keys(FALLBACK_SCRIPTS) as CheckinStageKey[]).map((stage) => {
    const synced = CHECKIN_SCRIPT_VARIANTS[stage];
    return [stage, synced && synced.length > 0 ? synced : FALLBACK_SCRIPTS[stage]];
  }),
) as Record<CheckinStageKey, readonly string[]>;

// One variation picked at random per call.
export function pickVariation(stage: CheckinStageKey): string {
  const variations = CHECKIN_SCRIPTS[stage];
  return variations[Math.floor(Math.random() * variations.length)];
}
