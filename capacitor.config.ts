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
  },
  server: {
    // Required for getUserMedia and inline audio playback on iOS WKWebView
    iosScheme: 'capacitor',
    allowNavigation: ['*.deepgram.com', '*.elevenlabs.io'],
  },
};

export default config;
