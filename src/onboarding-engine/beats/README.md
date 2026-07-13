# Onboarding preview beats

To add or change a beat preview, edit only its own file: `beats/<component.key>.tsx`.
Default-export a `({ beat, onAdvance }) => JSX.Element` renderer.

`beatRegistry.ts` assembles the registry automatically with `import.meta.glob`, so parallel branches never collide. Never hand-edit the registry.
