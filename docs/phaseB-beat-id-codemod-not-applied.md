# Phase B beat-ID codemod inventory (not applied)

The generated `@gg/shared/onboarding/beatIds` module is deliberately additive in
this milestone. The following hand-copied identity maps remain untouched until
the consumer migration milestone, where imports will be repointed and each old
map deleted in the same change.

1. `src/lib/onboarding/onboardingStepBeats.ts`: Vapi and local-capture screen sets.
2. `src/onboarding-flow/useFlowOrchestrator.ts`: `VAPI_UNGUARDED_SETUP_SCREENS`.
3. `packages/shared/src/onboarding/screenKind.ts`: `MULTI_SCREENS`.
4. `src/components/onboarding/onboardingOpeners.ts`: profile/fork screen sets and opener map.
5. `src/onboarding-flow/renderer/narration/narrationClips.ts`: legacy clip-id fallback ownership.

These are not all mechanically equivalent today. The follow-up must map their
consumer-specific behavior onto beat IDs rather than blindly replacing strings.
