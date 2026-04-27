# Life Growth Tracker

A voice-powered habit tracking and self-improvement app. Built with React, Vite, TypeScript, and Supabase..

## Features

- **Voice Commands** — Talk to your app: create habits, mark them done, get stats
- **Spreadsheet View** — Week/month grid for fast habit tracking
- **Form View** — Simple Yes/No daily check-in
- **Text-to-Speech** — App talks back with results
- **Haptic Feedback** — Vibration on mobile when commands are recognized
- **Supabase Backend** — Real-time data persistence
- **Glassmorphic UI** — Beautiful light blue design

## Voice Commands

| Say this                             | What it does                |
| ------------------------------------ | --------------------------- |
| "Create a habit called meditation"   | Add a new habit             |
| "Mark meditation done"               | Complete a habit for today  |
| "Delete the exercise habit"          | Remove a habit              |
| "Rename exercise to morning workout" | Update a habit              |
| "Show my habits"                     | List all habits             |
| "How am I doing with meditation?"    | View stats/streaks          |
| "Log sleep quality as 8"             | Record a metric value       |
| "I feel stressed"                    | Save a journal reflection   |
| "Suggest a habit"                    | Get a recommendation        |
| "Help"                               | Show all available commands |

## Getting Started

### Prerequisites

- Node.js v16+
- npm

### Environment Variables

Create a `.env` file:

```env
# Supabase (required for data persistence)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# OpenAI (voice parsing + TTS fallback)
OPENAI_API_KEY=sk-...

# Cartesia (primary TTS + STT)
CARTESIA_API_KEY=your-cartesia-key
```

**Data Layer Toggle:**

- With `VITE_SUPABASE_URL` set → uses Supabase (production)
- Without it → falls back to `localStorage` (development/offline)

### Installation

```bash
git clone https://gitlab.com/guidedgrowth-group/guided-growth-mvp.git
cd guided-growth-mvp
npm install
npm run dev
```

### Deployment

```bash
npx vercel --prod
```

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Supabase (Postgres + Auth)
- OpenAI GPT-4o-mini (voice command parsing)
- Cartesia Sonic-3 (TTS) / OpenAI Whisper (STT)
- Web Vibration API / Capacitor Haptics

## Architecture

```
src/
├── api/              # API layer (entries, metrics, preferences)
├── components/       # UI components (capture, layout, voice)
├── hooks/            # React hooks (useVoiceInput, useVoiceCommand, useEntries)
├── lib/
│   ├── config/       # Externalized config (dispatcher, prompts)
│   ├── prompts/      # GPT system prompts
│   └── services/     # Core services
│       ├── action-dispatcher.ts    # Voice command → action routing
│       ├── supabase-data-service.ts # Supabase CRUD
│       ├── mock-data-service.ts    # localStorage fallback
│       ├── tts-service.ts          # Text-to-Speech
│       ├── haptic-service.ts       # Haptic feedback
│       └── mic-permissions.ts      # Microphone permissions
├── pages/            # Route pages
└── stores/           # Zustand state management
```

## License

MIT
