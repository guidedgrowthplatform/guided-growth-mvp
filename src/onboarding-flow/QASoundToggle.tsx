/**
 * QASoundToggle — a pill that mutes / unmutes onboarding audio in QA / dev builds.
 *
 * Rendered next to QAFab (just to its left) so QA testers can silence the coach
 * without stopping playback of the whole beat sequence. Same gate as QAFab:
 * only visible when VITE_QA_SCREEN_ENABLED=true or in a local dev build.
 *
 * Placement: callers wrap QAFab + QASoundToggle in a fixed flex row (see App.tsx),
 * keeping both pills visually grouped in the top-right corner.
 */

import { isQaMuted, setQaMuted, useQaMuted } from './qaSound';

const QA_FAB_ENABLED = import.meta.env.VITE_QA_SCREEN_ENABLED === 'true' || import.meta.env.DEV;

// Pill width + gap so the toggle sits directly to the left of the QA pill.
// QAFab is 30px tall, ~72px wide (padding 11px each side + ~50px text).
// We position via the shared fixed flex row in App.tsx, so no offset math here.

export function QASoundToggle() {
  const muted = useQaMuted();

  if (!QA_FAB_ENABLED) return null;

  const handleClick = () => {
    setQaMuted(!isQaMuted());
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={muted ? 'Unmute QA audio' : 'Mute QA audio'}
      title="Toggle sound (QA)"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 30,
        width: 36,
        padding: 0,
        border: 'none',
        borderRadius: 999,
        background: muted ? 'rgb(75,85,99)' : 'rgb(37,99,235)',
        color: '#fff',
        fontFamily: 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 16,
        boxShadow: '0 6px 18px -5px rgba(0,0,0,0.4)',
        opacity: 0.9,
        cursor: 'pointer',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}

export default QASoundToggle;
