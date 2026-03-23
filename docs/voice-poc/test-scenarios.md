# Voice POC — Test Scenarios

Last validated: 2026-03-04 | Branch: `feat/voice-mock-testing`

## Architecture

```
Mic (Web Speech API) → STT transcript
  → localParse fallback / GPT-4o-mini → { action, entity, params }
    → ActionDispatcher → MockDataService (localStorage)
      → UI updates (Capture / Configure / Report)
```

## Tier 1 — Simple CRUD ✅

| #   | Voice Command                       | Parsed Intent                                                | UI Result             | Status |
| --- | ----------------------------------- | ------------------------------------------------------------ | --------------------- | ------ |
| 1   | "Create a habit called meditation"  | `create → habit { name: meditation }`                        | Habit in Capture grid | ✅     |
| 2   | "Add a metric called sleep quality" | `create → metric { name: sleep quality, inputType: binary }` | Metric in Configure   | ✅     |
| 3   | "Mark meditation done for today"    | `complete → habit { name: meditation, date: today }`         | Green ✅ cell in grid | ✅     |
| 4   | "Delete the exercise habit"         | `delete → habit { name: exercise }`                          | Habit removed         | ✅     |
| 5   | "Show my habits"                    | `query → habit {}`                                           | Navigate to Capture   | ✅     |

## Tier 2 — Parameterized ✅ (3/5 required, 4/5 working)

| #   | Voice Command                          | Parsed Intent                                                     | UI Result                 | Status                                |
| --- | -------------------------------------- | ----------------------------------------------------------------- | ------------------------- | ------------------------------------- |
| 6   | "Create exercise, three times a week"  | `create → habit { name: exercise, frequency: 3x/week }`           | Habit with frequency      | ✅                                    |
| 7   | "Add a metric for mood, scale 1 to 10" | `create → metric { name: mood, inputType: scale, scale: [1,10] }` | Scale metric in Configure | ✅                                    |
| 8   | "Log my sleep quality as 8 out of 10"  | `log → metric { name: sleep quality, value: 8 }`                  | Value in entries          | ✅                                    |
| 9   | "Mark meditation done for Mon Tue Wed" | `complete → habit { name: meditation, dates: [mon,tue,wed] }`     | Multiple checkmarks       | ⚠️ Partial — multi-date not supported |
| 10  | "Rename exercise to morning workout"   | `update → habit { name: exercise, newName: morning workout }`     | Name updated              | ✅                                    |

## Tier 3 — Contextual / Analytical ✅ (2/5 required, 4/5 working)

| #   | Voice Command                                | Parsed Intent                                             | UI Result               | Status                                   |
| --- | -------------------------------------------- | --------------------------------------------------------- | ----------------------- | ---------------------------------------- |
| 11  | "How am I doing with meditation this month?" | `query → habit { name: meditation, period: month }`       | Summary displayed       | ✅                                       |
| 12  | "What's my longest streak?"                  | `query → habit { metric: streak, sort: longest }`         | Streak info             | ✅                                       |
| 13  | "I slept terribly and I'm feeling stressed"  | `reflect → journal { mood: low, themes: [sleep,stress] }` | Journal entry saved     | ✅                                       |
| 14  | "Suggest a new habit for me"                 | `suggest → habit {}`                                      | AI suggestion generated | ✅                                       |
| 15  | "Give me a weekly summary"                   | `query → summary { period: week }`                        | Aggregated report       | ⚠️ Local parser hits `query` but limited |

## Key Modules

| Module                | Path                                            | Description                                   |
| --------------------- | ----------------------------------------------- | --------------------------------------------- |
| DataService interface | `src/lib/services/data-service.interface.ts`    | Abstract contract for all CRUD methods        |
| MockDataService       | `src/lib/services/mock-data-service.ts`         | localStorage implementation of DataService    |
| ActionDispatcher      | `src/lib/services/action-dispatcher.ts`         | Maps intent → DataService method calls        |
| TTS Service           | `src/lib/services/tts-service.ts`               | Talk-back voice with pleasant voice selection |
| Voice Settings Store  | `src/stores/voiceSettingsStore.ts`              | Recording mode + TTS toggle + voice pref      |
| Local Intent Parser   | `src/hooks/useVoiceCommand.ts` → `localParse()` | Regex-based fallback parser (no API needed)   |

## Seed Data

On first load (empty localStorage), the app seeds:

- **3 habits**: meditation (daily), exercise (daily), reading (daily)
- **2 metrics**: sleep quality (scale 1-10), mood (scale 1-10)
- **Completions**: Past 4 days for meditation, 3 for exercise, 2 for reading

## Error Handling

| Scenario             | Behavior                                     |
| -------------------- | -------------------------------------------- |
| Unrecognized command | Toast: "I didn't understand that"            |
| Missing habit name   | Toast: "Missing name for creation"           |
| Habit not found      | Toast: `Habit "X" not found`                 |
| Empty/garbage name   | Low confidence (0.3), rejected by dispatcher |
| No microphone access | Error shown in voice panel                   |

## Voice Settings

| Setting          | Options               | Default        | Persisted       |
| ---------------- | --------------------- | -------------- | --------------- |
| Recording mode   | auto-stop / always-on | auto-stop      | ✅ localStorage |
| TTS Voice        | All English voices    | Best available | ✅ localStorage |
| Talk-back toggle | on / off              | on             | ✅ localStorage |
