import type { CapacitorConfig } from '@capacitor/cli';

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
    scheme: 'Guided Growth',
    allowsLinkPreview: false,
    scrollEnabled: false,
  },
  server: {
    // Required for getUserMedia and inline audio playback on iOS WKWebView
    iosScheme: 'capacitor',
    // Make Android scheme explicit (matches Capacitor 3+ default). The
    // resulting WebView origin is `https://localhost`, which MUST be in
    // api/_lib/cors.ts ALLOWED_ORIGINS or every fetch from Android fails
    // CORS preflight with "Could not connect to server".
    androidScheme: 'https',
    allowNavigation: [
      'api.deepgram.com',
      'api.elevenlabs.io',
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
