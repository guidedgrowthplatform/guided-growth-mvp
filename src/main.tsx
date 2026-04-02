import { Capacitor } from '@capacitor/core';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initAnalytics } from './lib/analytics';
import { initSentry } from './lib/sentry';
import './index.css';

initSentry();
initAnalytics();

// Disable pinch-to-zoom only in native Capacitor shell
if (Capacitor.isNativePlatform()) {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover',
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
