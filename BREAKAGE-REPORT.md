# Breakage report: delete legacy now

Override date: 2026-07-20

Branch: `chore/delete-legacy-now`

This is a deliberate whole-file purge. No imports, shared-spine files, migrations, or surviving flows were repaired after deletion.

## Deleted files

### Legacy screen-id plumbing, 12 files

| File                                                  | Reason                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `api/_lib/llm/onboarding/stepMaps.generated.ts`       | Generated legacy screen-id step map.                                                  |
| `scripts/diff-beat-machinery.ts`                      | Migration comparison between legacy screen contexts and the retired Vapi beat bundle. |
| `src/components/onboarding/onboardingOpeners.test.ts` | Test only for the deleted legacy-id opener registry.                                  |
| `src/components/onboarding/onboardingOpeners.ts`      | Legacy screen-id keyed onboarding opener registry.                                    |
| `src/data/screen-contexts.json`                       | Legacy screen-id context data artifact.                                               |
| `src/generated/screen_contexts.json`                  | Generated legacy screen-id context and route bundle.                                  |
| `src/hooks/useScreenMap.ts`                           | Legacy screen-id route resolver.                                                      |
| `src/lib/context/screenContextsBundle.test.ts`        | Test only for the deleted legacy screen-context bundle.                               |
| `src/lib/context/screenContextsBundle.ts`             | Frontend reader for the deleted legacy screen-context bundle.                         |
| `src/lib/context/screenIdForRoute.test.ts`            | Test only for the deleted legacy route-to-screen-id resolver.                         |
| `src/lib/context/screenIdForRoute.ts`                 | Legacy route-to-screen-id resolver.                                                   |
| `src/onboarding-flow/__tests__/stepMapParity.test.ts` | Parity test whose primary contract is the deleted generated legacy step map.          |

### Vapi remnants, 47 files

| File                                                                   | Reason                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| `api/_lib/vapi/__tests__/handlers-reconcile.test.ts`                   | Test only for the Vapi webhook handlers.                     |
| `api/_lib/vapi/__tests__/weekly.test.ts`                               | Test only for Vapi weekly webhook handlers.                  |
| `api/_lib/vapi/debugChannel.ts`                                        | Vapi webhook debug broadcaster.                              |
| `api/_lib/vapi/dispatch.ts`                                            | Vapi tool-call dispatcher.                                   |
| `api/_lib/vapi/handlers/addHabit.ts`                                   | Vapi tool handler.                                           |
| `api/_lib/vapi/handlers/confirmPlan.ts`                                | Vapi tool handler.                                           |
| `api/_lib/vapi/handlers/navigateNext.ts`                               | Vapi tool handler.                                           |
| `api/_lib/vapi/handlers/removeHabit.ts`                                | Vapi tool handler.                                           |
| `api/_lib/vapi/handlers/submitBrainDump.ts`                            | Vapi tool handler.                                           |
| `api/_lib/vapi/handlers/submitCategory.ts`                             | Vapi tool handler.                                           |
| `api/_lib/vapi/handlers/submitCustomPrompts.ts`                        | Vapi tool handler.                                           |
| `api/_lib/vapi/handlers/submitGoals.ts`                                | Vapi tool handler.                                           |
| `api/_lib/vapi/handlers/submitMorningCheckin.ts`                       | Vapi tool handler.                                           |
| `api/_lib/vapi/handlers/submitPathChoice.ts`                           | Vapi tool handler.                                           |
| `api/_lib/vapi/handlers/submitProfile.ts`                              | Vapi tool handler.                                           |
| `api/_lib/vapi/handlers/submitReflectionConfig.ts`                     | Vapi tool handler.                                           |
| `api/_lib/vapi/handlers/submitWeeklyConfig.ts`                         | Vapi tool handler.                                           |
| `api/_lib/vapi/handlers/updateHabit.ts`                                | Vapi tool handler.                                           |
| `api/_lib/vapi/handlers/weeklyAddHabit.ts`                             | Vapi tool handler.                                           |
| `api/_lib/vapi/handlers/weeklyAdvance.ts`                              | Vapi tool handler.                                           |
| `api/_lib/vapi/handlers/weeklyArchiveHabit.ts`                         | Vapi tool handler.                                           |
| `api/_lib/vapi/handlers/weeklyComplete.ts`                             | Vapi tool handler.                                           |
| `api/_lib/vapi/handlers/weeklyUpdateHabit.ts`                          | Vapi tool handler.                                           |
| `api/_lib/vapi/verifySecret.ts`                                        | Vapi webhook secret verifier.                                |
| `api/vapi/[...path].ts`                                                | Vapi webhook broker entrypoint.                              |
| `scripts/build-beat-bundle.ts`                                         | Generator for the deleted frontend Vapi beat-context bundle. |
| `scripts/vapi-sync/assistant.ts`                                       | Vapi assistant synchronization tooling.                      |
| `scripts/vapi-sync/sync.ts`                                            | Vapi synchronization entrypoint.                             |
| `scripts/vapi-sync/vapi.lock.json`                                     | Vapi production synchronization lock data.                   |
| `scripts/vapi-sync/vapi.lock.staging.json`                             | Vapi staging synchronization lock data.                      |
| `scripts/vapi-sync/wrap.ts`                                            | Vapi synchronization wrapper.                                |
| `src/components/voice/VoiceCapModal.tsx`                               | UI exclusively for the retired Vapi daily voice cap.         |
| `src/contexts/OnboardingVoiceProvider.tsx`                             | Vapi-primary onboarding realtime voice provider.             |
| `src/contexts/__tests__/OnboardingVoiceProvider.screenIdRace.test.tsx` | Test only for the deleted Vapi-primary provider.             |
| `src/contexts/__tests__/idleTimerGate.test.ts`                         | Test only for the Vapi idle-call timer.                      |
| `src/contexts/__tests__/vapiLiveGate.test.ts`                          | Test only for the Vapi live-call gate.                       |
| `src/contexts/idleTimerGate.ts`                                        | Vapi live-call idle timer gate.                              |
| `src/contexts/vapiLiveGate.ts`                                         | Vapi live-call gate.                                         |
| `src/generated/beat_contexts.json`                                     | Generated Vapi onboarding beat-context bundle.               |
| `src/hooks/__tests__/useRealtimeVoice.onEndLatch.test.ts`              | Test only for the Vapi realtime voice hook.                  |
| `src/hooks/useRealtimeVoice.ts`                                        | Vapi client lifecycle hook.                                  |
| `src/lib/context/onboardingBeatBundle.test.ts`                         | Test only for the deleted frontend Vapi beat bundle.         |
| `src/lib/context/onboardingBeatBundle.ts`                              | Frontend Vapi onboarding beat-context composer.              |
| `src/lib/voice/buildAssistantOverrides.test.ts`                        | Test only for Vapi assistant overrides.                      |
| `src/lib/voice/buildAssistantOverrides.ts`                             | Vapi assistant override builder.                             |
| `src/onboarding-flow/QAVapiToggle.tsx`                                 | QA control exclusively for enabling Vapi.                    |
| `src/onboarding-flow/qaVapi.ts`                                        | QA Vapi local-storage toggle state.                          |

### Legacy-named onboarding audio, 17 files

| File                                                          | Reason                                |
| ------------------------------------------------------------- | ------------------------------------- |
| `public/voice/onboarding/ONBOARD-ADVANCED-FREQUENCY.mp3`      | Legacy `ONBOARD-*` named audio asset. |
| `public/voice/onboarding/ONBOARD-ADVANCED.mp3`                | Legacy `ONBOARD-*` named audio asset. |
| `public/voice/onboarding/ONBOARD-BEGINNER-01.mp3`             | Legacy `ONBOARD-*` named audio asset. |
| `public/voice/onboarding/ONBOARD-BEGINNER-02.mp3`             | Legacy `ONBOARD-*` named audio asset. |
| `public/voice/onboarding/ONBOARD-BEGINNER-03.mp3`             | Legacy `ONBOARD-*` named audio asset. |
| `public/voice/onboarding/ONBOARD-BEGINNER-04.mp3`             | Legacy `ONBOARD-*` named audio asset. |
| `public/voice/onboarding/ONBOARD-BEGINNER-07.mp3`             | Legacy `ONBOARD-*` named audio asset. |
| `public/voice/onboarding/ONBOARD-COMPLETE.mp3`                | Legacy `ONBOARD-*` named audio asset. |
| `public/voice/onboarding/ONBOARD-FORK--FORM.mp3`              | Legacy `ONBOARD-*` named audio asset. |
| `public/voice/onboarding/ONBOARD-MORNING-SETUP.mp3`           | Legacy `ONBOARD-*` named audio asset. |
| `public/voice/onboarding/ONBOARD-STATE-CHECK.mp3`             | Legacy `ONBOARD-*` named audio asset. |
| `public/voice/onboarding/ONBOARD-WEEKLY-PROJECTION-BLANK.mp3` | Legacy `ONBOARD-*` named audio asset. |
| `public/voice/onboarding/ONBOARD-WEEKLY-PROJECTION-FULL.mp3`  | Legacy `ONBOARD-*` named audio asset. |
| `public/voice/onboarding/ONBOARD-WEEKLY-PROJECTION-GAPS.mp3`  | Legacy `ONBOARD-*` named audio asset. |
| `public/voice/onboarding/ONBOARD-WEEKLY-PROJECTION-P36.mp3`   | Legacy `ONBOARD-*` named audio asset. |
| `public/voice/onboarding/ONBOARD-WEEKLY-PROJECTION-P78.mp3`   | Legacy `ONBOARD-*` named audio asset. |
| `public/voice/onboarding/ONBOARD-WHY-INTRO.mp3`               | Legacy `ONBOARD-*` named audio asset. |

### Demonstrably retired demo flow, 2 files

| File                                                         | Reason                                                                                                               |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `src/onboarding-flow/flows/designer-source.lane-a-demo.json` | Its own `source` field labels it a Lane A capability demo, QA preview only, and droppable once Lane B content lands. |
| `src/onboarding-flow/flows/lane-a-demo-v1.generated.json`    | Generated output of the explicitly retired Lane A QA demo source.                                                    |

## Judgment-call keeps, 15 files

| File                                                       | Reason kept whole and untouched                                                                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `api/_lib/llm/onboarding/beatContexts.ts`                  | Explicitly retained live coach-context registry, not a Vapi broker.                                                                       |
| `api/_lib/llm/onboarding/beatContexts.generated.json`      | Explicitly retained generated counterpart of the live coach-context registry.                                                             |
| `scripts/flow-sync/generate-flow.ts`                       | Generates several current live flows, even though it now retains stale outputs for the intentionally deleted demo and step-map artifacts. |
| `src/contexts/useOnboardingVoiceSession.ts`                | Its context contract carries Direct-LLM onboarding behavior as well as Vapi types.                                                        |
| `src/hooks/useNavigateLogger.ts`                           | Navigation session logging is a core app capability; its screen-id lookup is incidental.                                                  |
| `src/lib/config/voice.ts`                                  | Shared voice-in flags and asset URL support remain useful outside Vapi.                                                                   |
| `src/lib/context/getScreenContext.ts`                      | Core LLM context retrieval, despite now intentionally importing removed legacy bundles.                                                   |
| `src/lib/voice/__tests__/openerWordTimeline.test.ts`       | Tests the shared Cartesia and MP3 opener word-timing utility.                                                                             |
| `src/lib/voice/__tests__/speakOpener.sse.test.ts`          | Tests Cartesia opener playback, not a Vapi client.                                                                                        |
| `src/lib/voice/openerWordTimeline.ts`                      | Shared Cartesia and MP3 opener timing utility.                                                                                            |
| `src/lib/voice/speakOpener.ts`                             | Used by direct Cartesia opener rendering as well as the retired Vapi path.                                                                |
| `src/onboarding-flow/beatEngineMeta.ts`                    | Live flow metadata also controls non-Vapi MP3, Cartesia, and capture beats.                                                               |
| `src/onboarding-flow/flows/__tests__/openerAssets.test.ts` | Validates runtime-playability of the live flow, including Cartesia metadata, not only the deleted clips.                                  |
| `src/onboarding-flow/renderer/resolveBeatOpener.test.ts`   | Still tests the surviving flow-document opener resolution behavior.                                                                       |
| `src/onboarding-flow/renderer/resolveBeatOpener.ts`        | Resolves authored flow openers and has a now-broken legacy fallback; it remains part of the live renderer.                                |

The explicitly protected current onboarding, check-in, and home-tour generated flows, their fixtures, and `designerToFlow.ts` were also left untouched. Shared API, analytics, layout, home, and migration files were left untouched.

## Verification

Dependencies were absent in this worktree, so `npm install` was run first. It completed successfully, with an existing Node 20 versus Capacitor Node 22 engine warning. No dependency manifests changed.

### `npm run type-check` output

```text

> life-growth-tracker@2.1.0 type-check
> tsc --noEmit

api/_lib/llm/onboarding/systemPromptAddendum.ts(4,32): error TS2307: Cannot find module './stepMaps.generated.js' or its corresponding type declarations.
src/App.tsx(5,41): error TS2307: Cannot find module '@/contexts/OnboardingVoiceProvider' or its corresponding type declarations.
src/App.tsx(22,30): error TS2307: Cannot find module '@/onboarding-flow/QAVapiToggle' or its corresponding type declarations.
src/components/layout/BottomNav.tsx(14,30): error TS2307: Cannot find module '@/hooks/useScreenMap' or its corresponding type declarations.
src/contexts/useOnboardingVoiceSession.ts(8,46): error TS2307: Cannot find module '@/hooks/useRealtimeVoice' or its corresponding type declarations.
src/hooks/useNavigateLogger.ts(4,30): error TS2307: Cannot find module './useScreenMap' or its corresponding type declarations.
src/hooks/useOnboardingChat.ts(4,44): error TS2307: Cannot find module '@/components/onboarding/onboardingOpeners' or its corresponding type declarations.
src/lib/context/getScreenContext.ts(6,8): error TS2307: Cannot find module '@/lib/context/onboardingBeatBundle' or its corresponding type declarations.
src/lib/context/getScreenContext.ts(7,40): error TS2307: Cannot find module '@/lib/context/screenContextsBundle' or its corresponding type declarations.
src/onboarding-flow/renderer/resolveBeatOpener.ts(28,45): error TS2307: Cannot find module '@/components/onboarding/onboardingOpeners' or its corresponding type declarations.
src/onboarding-flow/transform/deriveStepMaps.test.ts(14,8): error TS2307: Cannot find module '../../../api/_lib/llm/onboarding/stepMaps.generated' or its corresponding type declarations.
src/onboarding-flow/useFlow.ts(32,36): error TS2307: Cannot find module './flows/lane-a-demo-v1.generated.json' or its corresponding type declarations.
```

### `npm run build` output

```text

> life-growth-tracker@2.1.0 build
> vite build

[vite] API proxy target: http://localhost:3000
vite v5.4.21 building for production...
transforming...
✓ 51 modules transformed.
x Build failed in 1.30s
error during build:
[vite-plugin-pwa:build] [plugin vite-plugin-pwa:build] There was an error during the build:
  Could not load /Users/yairamsel/Developer/claude-work/gg-legacy-purge/src/contexts/OnboardingVoiceProvider (imported by src/App.tsx): ENOENT: no such file or directory, open '/Users/yairamsel/Developer/claude-work/gg-legacy-purge/src/contexts/OnboardingVoiceProvider'
Additionally, handling the error in the 'buildEnd' hook caused the following error:
  Could not load /Users/yairamsel/Developer/claude-work/gg-legacy-purge/src/contexts/OnboardingVoiceProvider (imported by src/App.tsx): ENOENT: no such file or directory, open '/Users/yairamsel/Developer/claude-work/gg-legacy-purge/src/contexts/OnboardingVoiceProvider'
    at getRollupError (file:///Users/yairamsel/Developer/claude-work/gg-legacy-purge/node_modules/rollup/dist/es/shared/parseAst.js:406:41)
    at file:///Users/yairamsel/Developer/claude-work/gg-legacy-purge/node_modules/rollup/dist/es/shared/node-entry.js:23863:39
    at async catchUnfinishedHookActions (file:///Users/yairamsel/Developer/claude-work/gg-legacy-purge/node_modules/rollup/dist/es/shared/node-entry.js:23321:16)
    at async rollupInternal (file:///Users/yairamsel/Developer/claude-work/gg-legacy-purge/node_modules/rollup/dist/es/shared/node-entry.js:23846:5)
    at async build (file:///Users/yairamsel/Developer/claude-work/gg-legacy-purge/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:65709:14)
    at async CAC.<anonymous> (file:///Users/yairamsel/Developer/claude-work/gg-legacy-purge/node_modules/vite/dist/node/cli.js:829:5)
```

Breakage size: 12 typecheck errors and one build-stopping missing-module error, with the build tool printing the same missing-module failure twice through its hook error path.
