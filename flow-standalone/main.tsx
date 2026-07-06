import { useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { FlowDesigner } from '@/components/flow-designer/FlowDesigner';
import { FlowPlay } from '@/components/flow-designer/FlowPlay';

// Two modes over the same real components:
//  - Annotated: the whole flow top to bottom (engine / screen / words), settled.
//  - Play: the flow played in order, voice-driven reveal, one phone at a time.
// The toggle is a fixed pill; the mode also rides the URL hash (#play) so a link
// can open straight into the player.
function App() {
  const initial = typeof location !== 'undefined' && location.hash === '#play' ? 'play' : 'annotated';
  const [mode, setMode] = useState<'annotated' | 'play'>(initial);
  const choose = (m: 'annotated' | 'play') => {
    setMode(m);
    if (typeof history !== 'undefined') history.replaceState(null, '', m === 'play' ? '#play' : '#');
  };
  const tab = (active: boolean): CSSProperties => ({
    border: 'none',
    borderRadius: 999,
    padding: '7px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    background: active ? '#135BEB' : 'transparent',
    color: active ? '#fff' : '#334155',
  });
  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          zIndex: 50,
          display: 'flex',
          gap: 4,
          background: '#fff',
          borderRadius: 999,
          padding: 4,
          boxShadow: '0 6px 20px -6px rgba(15,23,42,0.28)',
          fontFamily: 'Urbanist, -apple-system, sans-serif',
        }}
      >
        <button style={tab(mode === 'annotated')} onClick={() => choose('annotated')}>
          Annotated
        </button>
        <button style={tab(mode === 'play')} onClick={() => choose('play')}>
          Play
        </button>
      </div>
      {mode === 'play' ? <FlowPlay /> : <FlowDesigner />}
    </>
  );
}

const el = document.getElementById('root');
if (el) createRoot(el).render(<App />);
