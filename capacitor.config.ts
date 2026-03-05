import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.guidedgrowth.mvp',
  appName: 'Guided Growth Tracker',
  webDir: 'dist',
  server: {
    url: 'https://guided-growth-mvp-six.vercel.app',
    cleartext: true,
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Guided Growth',
  },
};

export default config;
