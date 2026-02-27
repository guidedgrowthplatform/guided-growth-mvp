# Voice POC — Setup Guide

## Overview

This is the **Voice-Led Life OS Prototype** — a Next.js 16 + Capacitor application with voice input capabilities using the Web Speech API.

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- For iOS builds: macOS with Xcode 15+
- For Android builds: Android Studio with SDK 33+

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser (Chrome or Edge recommended for Web Speech API support).

## Voice Input

1. Click the **floating mic button** (bottom-right corner)
2. Grant microphone permission when prompted
3. Speak — your transcript appears in real-time
4. Click again to stop listening

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout with VoiceOverlay
│   ├── page.tsx            # Landing page
│   └── globals.css         # Global styles + voice animations
├── components/
│   ├── VoiceMicButton.tsx  # Floating mic FAB
│   ├── VoiceTranscript.tsx # Transcript display panel
│   └── VoiceOverlay.tsx    # Client wrapper (layout integration)
├── hooks/
│   └── useVoiceInput.ts    # Web Speech API hook
└── stores/
    └── voiceStore.ts       # Zustand voice state
```

## Building for Mobile

```bash
# Build the Next.js static export
npm run build

# Sync web assets to native projects
npx cap sync

# Open in Xcode (macOS only)
npx cap open ios

# Open in Android Studio
npx cap open android
```

## Key Technologies

| Technology | Purpose |
|---|---|
| **Next.js 16** | React framework with App Router |
| **Capacitor** | Native iOS/Android shell |
| **Zustand** | Lightweight state management |
| **Web Speech API** | Browser-native speech recognition |
| **Tailwind CSS 4** | Utility-first styling |

## Browser Compatibility

The Web Speech API (`SpeechRecognition`) is supported in:
- ✅ Chrome (desktop & Android)
- ✅ Edge
- ✅ Safari 14.1+
- ⚠️ Firefox — limited support, may require flags
- ❌ IE — not supported

## Build Commands

```bash
npm run dev      # Development server
npm run build    # Production build (static export to /out)
npm run start    # Start production server
npm run lint     # ESLint check
```
