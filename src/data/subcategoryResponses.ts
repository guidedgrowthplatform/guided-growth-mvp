/**
 * Section 19: Subcategory Voice Responses (Voice Journey CSV)
 *
 * Each subcategory has a unique coaching response from the AI.
 * Plays at ONBOARD-04 when user selects a subcategory, before navigating to ONBOARD-05.
 * All responses are pre-recorded via Cartesia TTS at runtime (not MP3).
 */

export const SUBCATEGORY_RESPONSES: Record<string, string> = {
  // ── Sleep Better ──────────────────────────────────────────
  'Fall asleep earlier':
    "I hear that a lot. And here's the thing — it's usually not about willpower. It's about what happens in the hour before bed. A couple of small shifts there change everything.",
  'Wake up earlier':
    'The secret to waking up earlier actually starts the night before. When your evening is set up right, mornings take care of themselves.',
  'Sleep more consistently':
    'Consistency is where the real gains are. Your body has a rhythm — and when you work with it instead of against it, everything improves. Sleep, energy, mood.',
  'Sleep more deeply':
    "Deep sleep is where your body actually recovers. Most people don't realize how much their environment and evening choices affect sleep quality — not just how long you sleep, but how well.",

  // ── Move More ─────────────────────────────────────────────
  'Walk more':
    "Walking is the most underrated form of movement. It clears your head, boosts your energy, and it's something you can do every single day without burning out. Let's build it in.",
  'Exercise consistently':
    "The key isn't working out harder — it's working out consistently. Two or three times a week, done reliably, beats five times a week done for two weeks and then nothing.",
  'Improve mobility':
    'A few minutes of stretching a day does more than people expect. It protects your body, clears tension, and makes everything else you do feel easier.',

  // ── Eat Better ────────────────────────────────────────────
  'Eat more intentionally':
    "Intentional eating isn't about restriction — it's about paying attention. When you actually notice what you're eating, better choices happen naturally.",
  'Reduce overeating':
    "Overeating is usually not about hunger — it's about patterns. Stress, routine, emotions. Once you notice what triggers it, you can start making different choices without fighting yourself.",
  'Plan food better':
    'The best food decisions happen the night before, not in the moment. When you plan ahead, you take willpower out of the equation.',

  // ── Feel More Energized ───────────────────────────────────
  'Have more morning energy':
    "Morning energy isn't random — it's built. What you do in the first thirty minutes after waking sets the tone for the entire day. Let's get those thirty minutes right.",
  'Avoid afternoon crashes':
    "That two to three PM crash isn't inevitable. It's usually about what you ate for lunch and whether you moved at all in the middle of the day. Small changes, big difference.",
  'Keep energy more stable':
    'Stable energy comes from the basics — water, movement, and consistent sleep. Simple things, but they compound. When your energy is steady, everything else gets easier.',

  // ── Reduce Stress ─────────────────────────────────────────
  'Feel calmer during the day':
    "Stress builds when you don't give yourself any breaks. Even two minutes of intentional pause in a busy day can reset how you feel.",
  'Reduce evening stress':
    'Evening stress is usually the day catching up with you. When you create a clear boundary between work and rest, your evenings actually become yours again.',
  'Feel less overwhelmed':
    "Overwhelm usually comes from carrying everything in your head. The moment you get it out — onto a list, a plan, anything external — it shrinks. Let's build that system.",

  // ── Improve Focus ─────────────────────────────────────────
  'Start work with less friction':
    "The hardest part of focused work is starting. Once you're in it, momentum takes over. These habits remove the friction between you and that first task.",
  'Do deeper work':
    "Deep work doesn't happen by accident — it happens by design. A block of time, no distractions, and a plan to protect it. Let's set that up.",
  'Procrastinate less':
    "Procrastination isn't laziness — it's usually avoidance of something uncomfortable. The trick is to make starting so small that your brain can't say no. Ten minutes on the hardest thing. That's it.",

  // ── Break Bad Habits ──────────────────────────────────────
  Smoking:
    "Quitting smoking — or even cutting back — is one of the hardest things a person can do. And the fact that you're here means you're ready to try. We'll take it one day at a time.",
  Weed: 'Changing your relationship with weed starts with noticing when and why you use it. Once you see the pattern, you can start making different choices — on your terms.',
  Alcohol:
    "Adjusting your drinking isn't all-or-nothing. Whether you're cutting back or taking days off, every boundary you set is a win. Let's find what works for you.",
  Porn: "This is a personal one, and I respect you for putting it here. Changing this habit is about replacing the trigger, not just resisting it. Let's set up some boundaries that actually help.",
  'Phone use':
    "Your phone is designed to keep you on it. That's not a personal failure — it's by design. These habits put you back in control of when and how you use it.",
  'Late-night snacking':
    'Late-night snacking is usually the habit, not actual hunger. Once you change the routine around dinner time, the urge fades on its own.',
  Caffeine:
    "Caffeine isn't the enemy — timing is. When you get the timing right, you keep the energy without the crash or the sleep disruption.",

  // ── Get More Organized ────────────────────────────────────
  'Stay on top of tasks':
    'The feeling of being behind on tasks usually comes from not having one clear system. When everything lives in one place and you check it daily, the chaos settles.',
  'Keep spaces tidy':
    'Your physical space affects your mental space more than most people realize. A quick daily reset keeps clutter from piling up and your mind from feeling heavy.',
  'Handle life admin better':
    'Life admin is the stuff that falls through the cracks — bills, appointments, paperwork. A small daily check and one weekly block keeps it from becoming a mountain.',
};
