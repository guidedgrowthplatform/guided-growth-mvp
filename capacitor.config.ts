import type { CapacitorConfig } from '@capacitor/cli';

const liveReloadUrl = process.env.CAP_LIVE_RELOAD_URL;

// Per-environment identity (dev / staging / main). Defaults to production so
// an unset env leaves the existing single-env build untouched. See docs/ENVIRONMENTS.md.
const appId = process.env.APP_IDENTIFIER ?? 'app.guidedgrowth.mvp';
const appName = process.env.APP_DISPLAY_NAME ?? 'Guided Growth';
// Comma-separated hosts to add to allowNavigation (e.g. a staging Supabase host).
const extraNavHosts = (process.env.CAP_EXTRA_NAV_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

const config: CapacitorConfig = {
  appId,
  appName,
  webDir: 'dist',
  // Local build: app loads from bundled dist/ folder.
  // This enables getUserMedia on iOS WKWebView (required for mic).
  // Trade-off: must rebuild + redeploy app for every code update.
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'App',
    allowsLinkPreview: false,
    scrollEnabled: false,
  },
  server: {
    iosScheme: 'capacitor',
    androidScheme: 'https',
    ...(liveReloadUrl
      ? { url: liveReloadUrl, cleartext: liveReloadUrl.startsWith('http://') }
      : {}),
    allowNavigation: [
      'api.cartesia.ai',
      'guided-growth-mvp.vercel.app',
      'pmunbflbjpoawicgimyc.supabase.co',
      'accounts.google.com',
      ...extraNavHosts,
    ],
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
