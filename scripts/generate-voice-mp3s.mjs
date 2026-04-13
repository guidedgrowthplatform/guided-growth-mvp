/**
 * Voice MP3 Generation Script
 *
 * Generates pre-recorded MP3 voice lines using Cartesia TTS API (primary)
 * with OpenAI TTS fallback if Cartesia is unavailable.
 * Writes to public/voice/ + updates src/data/voice-manifest.json.
 *
 * Usage:
 *   node scripts/generate-voice-mp3s.mjs
 *
 * Requires: CARTESIA_API_KEY and/or OPENAI_API_KEY in .env
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!CARTESIA_API_KEY && !OPENAI_API_KEY) {
  console.error('❌ Neither CARTESIA_API_KEY nor OPENAI_API_KEY found in .env');
  process.exit(1);
}

const CARTESIA_API_VERSION = '2026-03-01';
const OUTPUT_DIR = path.resolve('public/voice');
const MANIFEST_PATH = path.resolve('src/data/voice-manifest.json');

// Katie (female) voice — matches tts-service.ts default
const VOICE_ID = 'f786b574-daa5-4673-aa0c-cbe3e8534c02';

// ─── Voice Lines to Generate ────────────────────────────────────────────────
// Format: { file_id, text, screen, trigger }

const VOICE_LINES = [
  // Splash screen
  {
    file_id: 'splash_welcome',
    text: "Welcome to Guided Growth. I'm your personal coach, here to help you build habits that actually stick. Sign up and let's get started — it only takes a minute.",
    screen: 'splash',
    trigger: 'screen_load',
  },

  // Onboarding
  {
    file_id: 'onboarding_welcome',
    text: "Hey there! I'm your growth coach. I'll help you build habits that actually stick. Let's start with your name — what should I call you?",
    screen: 'onboarding/step1',
    trigger: 'screen_load',
  },
  {
    file_id: 'onboarding_experience',
    text: "Great! Now, have you tried building habits before? Are you new to this, or have you been at it for a while?",
    screen: 'onboarding/step2',
    trigger: 'screen_load',
  },
  {
    file_id: 'onboarding_focus_area',
    text: "What area of your life do you want to focus on first? Things like sleep, fitness, mindfulness, or productivity.",
    screen: 'onboarding/step3',
    trigger: 'screen_load',
  },
  {
    file_id: 'onboarding_challenge',
    text: "What's been the biggest challenge? Is it staying consistent, finding time, or knowing where to start?",
    screen: 'onboarding/step4',
    trigger: 'screen_load',
  },
  {
    file_id: 'onboarding_habit_pick',
    text: "Based on what you told me, here are a few habits that could work. Pick the one that feels right.",
    screen: 'onboarding/step5',
    trigger: 'screen_load',
  },
  {
    file_id: 'onboarding_reflection',
    text: "One more thing — do you want to do a quick daily reflection each evening? It takes under a minute and really helps.",
    screen: 'onboarding/step6',
    trigger: 'screen_load',
  },
  {
    file_id: 'onboarding_complete',
    text: "You're all set! Your first check-in is waiting on the home screen. Talk to you soon.",
    screen: 'onboarding/step7',
    trigger: 'on_complete',
  },

  // Dashboard
  {
    file_id: 'dashboard_morning',
    text: "Good morning! Ready for today? Let's check in on how you're doing.",
    screen: 'dashboard',
    trigger: 'screen_load',
  },
  {
    file_id: 'dashboard_evening',
    text: "How was today? Take a moment to reflect on what went well.",
    screen: 'dashboard',
    trigger: 'screen_load',
  },

  // Habit completion
  {
    file_id: 'habit_complete_1',
    text: "Nice work! One more down. Keep that momentum going.",
    screen: 'habit_detail',
    trigger: 'on_complete',
  },
  {
    file_id: 'habit_complete_streak',
    text: "You're on a streak! Consistency is where the magic happens.",
    screen: 'habit_detail',
    trigger: 'on_complete',
  },

  // Check-in
  {
    file_id: 'checkin_prompt',
    text: "Quick check-in time. How did you sleep? How's your mood and energy?",
    screen: 'checkin',
    trigger: 'screen_load',
  },
  {
    file_id: 'checkin_complete',
    text: "Got it. I'll track these patterns over time so we can spot what's working.",
    screen: 'checkin',
    trigger: 'on_complete',
  },
];

// ─── Generate ───────────────────────────────────────────────────────────────

async function generateWithCartesia(text) {
  if (!CARTESIA_API_KEY) throw new Error('CARTESIA_API_KEY not set');

  const response = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CARTESIA_API_KEY}`,
      'Content-Type': 'application/json',
      'Cartesia-Version': CARTESIA_API_VERSION,
    },
    body: JSON.stringify({
      model_id: 'sonic-3',
      transcript: text.trim(),
      voice: { mode: 'id', id: VOICE_ID },
      output_format: { container: 'mp3', encoding: 'mp3', sample_rate: 24000 },
      language: 'en',
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Cartesia ${response.status}: ${errText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function generateWithOpenAI(text) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text.trim(),
      voice: 'nova',
      response_format: 'mp3',
      speed: 1.0,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI TTS ${response.status}: ${errText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

/** Try Cartesia first, fall back to OpenAI TTS */
async function generateMp3(text) {
  try {
    return await generateWithCartesia(text);
  } catch (cartesiaErr) {
    if (OPENAI_API_KEY) {
      console.log(` ⚠️  Cartesia failed, using OpenAI fallback...`);
      return await generateWithOpenAI(text);
    }
    throw cartesiaErr;
  }
}

async function main() {
  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Load or create manifest
  let manifest = { files: {} };
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    } catch {
      console.warn('⚠️  Could not parse existing manifest, starting fresh');
    }
  }

  console.log(`\n🎙️  Generating ${VOICE_LINES.length} voice MP3s...\n`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const line of VOICE_LINES) {
    const filename = `${line.file_id}.mp3`;
    const filepath = path.join(OUTPUT_DIR, filename);

    // Skip if file exists and hash matches (unchanged text)
    const textHash = crypto.createHash('md5').update(line.text).digest('hex').slice(0, 8);
    if (manifest.files[line.file_id]?.hash === textHash && fs.existsSync(filepath)) {
      console.log(`  ⏭️  ${line.file_id} (unchanged)`);
      skipped++;
      continue;
    }

    try {
      process.stdout.write(`  🔊 ${line.file_id}...`);
      const buffer = await generateMp3(line.text);
      fs.writeFileSync(filepath, buffer);

      manifest.files[line.file_id] = {
        url: `/voice/${filename}`,
        hash: textHash,
        screen: line.screen,
        trigger: line.trigger,
        size_bytes: buffer.length,
        generated_at: new Date().toISOString(),
      };

      console.log(` ✅ (${(buffer.length / 1024).toFixed(1)} KB)`);
      generated++;

      // Rate limit: 100ms between requests
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      console.log(` ❌ ${err.message}`);
      failed++;
    }
  }

  // Write manifest
  manifest._comment = 'Auto-generated by scripts/generate-voice-mp3s.mjs — do not edit manually';
  manifest._generated_at = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`\n📊 Results: ${generated} generated, ${skipped} skipped, ${failed} failed`);
  console.log(`📁 Manifest: ${MANIFEST_PATH}`);
  console.log(`📂 MP3s: ${OUTPUT_DIR}/\n`);
}

main().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
