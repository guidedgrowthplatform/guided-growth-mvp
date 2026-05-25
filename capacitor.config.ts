import type { CapacitorConfig } from '@capacitor/cli';

const liveReloadUrl = process.env.CAP_LIVE_RELOAD_URL;

const config: CapacitorConfig = {
  appId: 'app.guidedgrowth.mvp',
  appName: 'Guided Growth Tracker',
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
    ],
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
