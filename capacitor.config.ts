import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.guidedgrowth.mvp',
  appName: 'Guided Growth',
  webDir: 'dist',
  server: {
    // Use the Vercel production URL for live data
    url: 'https://guided-growth-mvp-six.vercel.app',
    cleartext: true,
  },
};

export default config;
