/**
 * QAVapiToggle - QA/dev pill for enabling the paused Vapi path.
 *
 * Mirrors QASoundToggle and reloads after writes because ONBOARDING_CHAT_VAPI is
 * a module-load config const.
 */

import { isQaVapiEnabled, setQaVapiEnabled, useQaVapiEnabled } from './qaVapi';

const QA_FAB_ENABLED = import.meta.env.VITE_QA_SCREEN_ENABLED === 'true' || import.meta.env.DEV;

export function QAVapiToggle() {
  const enabled = useQaVapiEnabled();

  if (!QA_FAB_ENABLED) return null;

  const handleClick = () => {
    setQaVapiEnabled(!isQaVapiEnabled());
    window.location.reload();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={enabled ? 'Turn Vapi off' : 'Turn Vapi on'}
      title="Toggle Vapi (QA)"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 30,
        minWidth: 72,
        padding: '0 11px',
        border: 'none',
        borderRadius: 999,
        background: enabled ? 'rgb(22,163,74)' : 'rgb(75,85,99)',
        color: '#fff',
        fontFamily: 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '0.04em',
        boxShadow: '0 6px 18px -5px rgba(0,0,0,0.4)',
        opacity: 0.9,
        cursor: 'pointer',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {enabled ? 'Vapi on' : 'Vapi off'}
    </button>
  );
}

export default QAVapiToggle;
