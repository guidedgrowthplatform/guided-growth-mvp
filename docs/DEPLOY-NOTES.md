# Deploy notes (branch design/app-canonical-2026-07)

This branch's app-preview is deployed to **Timothy's own Cloudflare Pages project**,
NOT Yair's production project. Do not copy the deploy command from
`docs/FLOW-BUILDER.md` / `orb/ORB-BUILDER.md` verbatim, those point at
`gg-flow-builder` (Yair's production).

Correct command, run from the worktree root (D:/GuidedGrowth/gg-reconcile):

```
npm run build:flow
npx wrangler pages deploy dist-flow --project-name=gg-orb-timothy --commit-dirty=true
```

Live URL for Yair: https://design-app-canonical-2026-07.gg-orb-timothy.pages.dev/?app

- `?app` the 4-feature app-preview shell (Screen Time / Coach / Calendar / Reset)
- `?orb` the orb tuner only
- no param the flow designer
