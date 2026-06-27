# Flow builder (onboarding design tool)

The flow builder is the no-code authoring tool for the chat-native onboarding and
check-in flows. It compiles the real app components into a hostable static page,
so what you design is what ships. It lives on the `flow-builder-onboarding`
branch.

## Run it locally

Two ways:

### Dev server (hot reload, for editing)
```
npm run dev:flow
```
Serves at the printed local URL with HMR. Use this while editing beats.

### Static serve (the stable always-on view)
```
npm run serve:flow
```
Builds the flow builder and serves it at `http://localhost:7333` at the clean
root. A background loop rebuilds within ~15s of any change (your edits or other
sessions' pushed commits, fast-forwarded when the tree is clean), and the server
sends a no-cache header so a normal reload always shows the freshest build, no
hard refresh needed.

On this machine it runs as a launchd agent (`com.yair.flow-builder`), so 7333 is
always up. The script is `scripts/serve-flow-builder.sh`.

## Just build it
```
npm run build:flow
```
Outputs the standalone static build to `dist-flow/` (base `/`, with the
`public/` assets bundled so the category images render).

## Hosted URL

Live at: **https://gg-flow-builder.pages.dev**

Deployed to Cloudflare Pages (project `gg-flow-builder`, account
yair@guidedgrowthos.com). Today it updates on a manual redeploy:

```
npm run build:flow
wrangler pages deploy dist-flow --project-name=gg-flow-builder --branch=main --commit-dirty=true
```

To make it rebuild automatically on every push, connect the project to the GitLab
repo in the Cloudflare dashboard, or add a CI job that runs the two commands
above.
```

