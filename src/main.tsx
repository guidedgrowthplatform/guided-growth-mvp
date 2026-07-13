import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const CONTRACT_PREVIEW_PATH = '/onboarding/flow-preview';
const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
const root = ReactDOM.createRoot(document.getElementById('root')!);

function renderBootstrapError(message: string, error: unknown): void {
  console.error(message, error);
  root.render(
    <main
      role="alert"
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        margin: 0,
        padding: 24,
        background: '#EAF0F3',
        color: '#132B3B',
        fontFamily: 'Urbanist, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      {message}
    </main>,
  );
}

if (pathname === CONTRACT_PREVIEW_PATH) {
  void import('./onboarding-engine/ContractOnboardingPreview')
    .then(({ ContractOnboardingPreview }) => {
      root.render(
        <React.StrictMode>
          <ContractOnboardingPreview />
        </React.StrictMode>,
      );
    })
    .catch((error) =>
      renderBootstrapError('Unable to load the onboarding contract preview.', error),
    );
} else {
  void import('./bootstrapApp')
    .then(({ bootstrapApp }) => bootstrapApp(root))
    .catch((error) => {
      console.error('[app] failed to bootstrap', error);
      renderBootstrapError('Unable to load Guided Growth.', error);
    });
}
