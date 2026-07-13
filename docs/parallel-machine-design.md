# Parallel machine design

Guided Growth onboarding previews are designed so each beat can be built, reviewed, and merged independently. A beat preview has one owner file at `src/onboarding-engine/beats/<component.key>.tsx`. The preview registry is assembled automatically by Vite from those files, so adding a beat does not require editing a shared registry. Shared display helpers live in `_shared.tsx` and remain stable. This removes the usual merge conflict and scope-review problem caused by many branches editing one preview file.

Writers work in separate Git worktrees, one worktree per beat. They can build any number of beats at the same time. A small `flock`-based merge lease serializes the final merge operation: a writer acquires the lease, merges its verified beat, releases the lease, and the next writer continues. Parallel construction stays fast while the shared target branch remains orderly.

Each beat receives a tiered QA swarm before it can take the merge lease. Terra handles the judgment-heavy checks, especially contract fidelity and runtime correctness. A cheaper model handles mechanical checks such as scope, regression, and lint. Jobs are round-robined over the four Azure regions so capacity is balanced and a regional slowdown does not block all writers.

The final per-beat gate is a headless render check. It loads that beat's preview and asserts that genuine content renders. The check rejects a blank surface, a render error, or a missing beat renderer. Only a beat that passes this render check and its assigned QA lenses can enter the serialized merge queue.

The result is a parallel build machine: isolated ownership during implementation, automated discovery during integration, focused verification before merge, and a short serialized merge step only where serialization is necessary.
