import { useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { type OrbMic, type OrbStateSel, type OrbTalkStyle } from '@/components/orb/Orb';
import { HomeBarPreview } from './HomeBarPreview';
import {
  AUTHOR_PRESETS,
  MOTION_PRESETS,
  loadParams,
  loadPulse,
  loadSaved,
  resetParams,
  saveParams,
  savePulse,
  saveSavedList,
  type BarStyle,
  type OrbParams,
  type OrbStates,
  type PulseParams,
  type SavedPreset,
} from './orbPresets';

// The Orb workspace: the tuner (a big live orb + the controls) plus the home bar,
// which renders the SAME live orb small in its notch. Everything is driven by two
// editable looks (idle / talk) and a pulse config that persist in localStorage;
// named presets live in orbPresets.ts (in git). Because both orbs read the same
// params, tuning here updates the home bar live.

const BGS: Record<string, string> = {
  light: 'radial-gradient(120% 100% at 50% 0%, #ffffff 0%, #eef2f8 52%, #e2e8f1 100%)',
  blue: 'linear-gradient(to top, rgba(19,91,236,0.72) 0%, rgba(123,164,236,0.34) 50%, rgba(216,228,248,0.82) 100%), #ffffff',
  yellow:
    'linear-gradient(to top, rgba(253,208,23,0.74) 0%, rgba(250,228,140,0.34) 50%, rgba(244,241,226,0.82) 100%), #ffffff',
  dark: 'radial-gradient(130% 100% at 50% 0%, #1b2030 0%, #10131c 55%, #0a0c12 100%)',
};

type EditTab = 'idle' | 'talk' | 'pulse';

const GLASS_SLIDERS: { k: keyof OrbParams; label: string; min: number; max: number }[] = [
  { k: 'glass', label: 'Translucency', min: 0, max: 100 },
  { k: 'blur', label: 'Frost blur', min: 0, max: 100 },
  { k: 'hi', label: 'Highlight', min: 0, max: 100 },
  { k: 'rim', label: 'Rim', min: 0, max: 100 },
  { k: 'body', label: 'Body tone', min: 0, max: 100 },
];
const LIGHT_SLIDERS: { k: keyof OrbParams; label: string; min: number; max: number }[] = [
  { k: 'glow', label: 'Glow size', min: 50, max: 180 },
  { k: 'bright', label: 'Brightness', min: 60, max: 160 },
  { k: 'speed', label: 'Speed', min: 10, max: 100 },
  { k: 'grad', label: 'Gradient depth', min: 0, max: 100 },
  { k: 'core', label: 'Core size', min: 20, max: 100 },
  { k: 'spread', label: 'Particle spread', min: 12, max: 60 },
  { k: 'pglow', label: 'Particle glow', min: 0, max: 100 },
  { k: 'rand', label: 'Randomness', min: 0, max: 100 },
];
const DEPTH_SLIDERS: { k: keyof OrbParams; label: string; min: number; max: number }[] = [
  { k: 'aura', label: 'Outer aura', min: 0, max: 100 },
  { k: 'iris', label: 'Iridescent rim', min: 0, max: 100 },
  { k: 'depth', label: 'Glass depth', min: 0, max: 100 },
];
const PULSE_SLIDERS: { k: keyof PulseParams; label: string; min: number; max: number }[] = [
  { k: 'size', label: 'Base size', min: 0, max: 40 },
  { k: 'amt', label: 'Extra pulse', min: 0, max: 100 },
  { k: 'speed', label: 'Pulse speed', min: 0, max: 100 },
  { k: 'orbAmt', label: 'Orb expand', min: 0, max: 100 },
  { k: 'mem', label: 'Membrane breathe', min: 0, max: 100 },
  { k: 'memSpeed', label: 'Membrane speed', min: 0, max: 100 },
];

// Props the tuner hands to whatever renders the live preview (the home bar by
// default, or the app shell in app-preview mode).
export interface OrbPreviewProps {
  orbState: OrbStateSel;
  orbStyle: OrbTalkStyle;
  params: OrbStates;
  pulse: PulseParams;
  mic: MutableRefObject<OrbMic>;
  screenBg: string;
  bgKey: string;
  barStyle: BarStyle;
  // Orb overlay icons, per side. Off by default (canonical orb has none).
  iconLeft: boolean;
  iconRight: boolean;
}

interface OrbTunerProps {
  // Replace the default HomeBarPreview with a custom preview (the app shell)
  // driven by the SAME tuner state. Defaults to the home bar.
  renderPreview?: (p: OrbPreviewProps) => ReactNode;
}

export function OrbTuner({ renderPreview }: OrbTunerProps = {}) {
  const [params, setParams] = useState<OrbStates>(() => loadParams());
  const [pulse, setPulse] = useState<PulseParams>(() => loadPulse());
  const [saved, setSaved] = useState<SavedPreset[]>(() => loadSaved());
  const [presetName, setPresetName] = useState('');
  const [state, setState] = useState<OrbStateSel>('idle');
  const [editTab, setEditTab] = useState<EditTab>('idle');
  const [style, setStyle] = useState<OrbTalkStyle>('full');
  const [bg, setBg] = useState<string>('blue');
  const [author, setAuthor] = useState<string>(Object.keys(AUTHOR_PRESETS)[0] ?? 'Yair');
  // Orb overlay icons: off by default so the orb matches canonical (Yair flagged
  // the always-on chat/mic icons as a regression). Each side toggles on its own.
  const [leftOn, setLeftOn] = useState(false);
  const [rightOn, setRightOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [barStyle, setBarStyle] = useState<BarStyle>('white');

  const activeKey: 'idle' | 'talk' = editTab === 'idle' ? 'idle' : 'talk';
  const pickState = (k: OrbStateSel) => {
    setState(k);
    setEditTab((prev) => (prev === 'pulse' ? 'pulse' : k === 'idle' ? 'idle' : 'talk'));
  };
  const pickEdit = (k: EditTab) => {
    setEditTab(k);
    if (k === 'idle') setState('idle');
    else setState((s) => (s === 'idle' ? 'coach' : s));
  };

  const mic = useRef<OrbMic>({ on: false, amp: 0 });
  mic.current.on = micOn;

  // Real mic: flips to User talking and drives the pulse with your voice.
  const toggleMic = () => {
    if (micOn) {
      setMicOn(false);
      mic.current = { on: false, amp: 0 };
      setState('idle');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ac = new AC();
        const src = ac.createMediaStreamSource(stream);
        const analyser = ac.createAnalyser();
        analyser.fftSize = 512;
        const data = new Uint8Array(analyser.frequencyBinCount);
        src.connect(analyser);
        setMicOn(true);
        mic.current.on = true;
        setState('user');
        const poll = () => {
          if (!mic.current.on) return;
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          const target = Math.min(1, Math.max(0, (rms - 0.01) / 0.16));
          mic.current.amp += (target - mic.current.amp) * 0.3;
          requestAnimationFrame(poll);
        };
        requestAnimationFrame(poll);
      })
      .catch(() => {
        /* mic blocked */
      });
  };

  const setP = (k: keyof OrbParams, v: number) => {
    setParams((prev) => {
      const next: OrbStates = JSON.parse(JSON.stringify(prev));
      next[activeKey][k] = v;
      saveParams(next);
      return next;
    });
  };
  const setPulseP = (k: keyof PulseParams, v: number) => {
    setPulse((prev) => {
      const next = { ...prev, [k]: v };
      savePulse(next);
      return next;
    });
  };
  const applyMotion = (name: string) => {
    const p = MOTION_PRESETS[name];
    if (!p) return;
    const next = { ...p };
    savePulse(next);
    setPulse(next);
  };
  const applyPreset = (name: string) => {
    const pr = AUTHOR_PRESETS[author]?.[name];
    if (!pr) return;
    const isYair = author === 'Yair';
    setParams((prev) => {
      const next: OrbStates = JSON.parse(JSON.stringify(prev));
      Object.assign(next[activeKey], pr);
      // Yair's presets are his standard look. Force the optional visual layers
      // (aura / iris / depth) off too, so they never linger from a Timothy
      // preset. Combined with the motion reset below, his looks are pristine
      // no matter what was applied before.
      if (isYair) {
        next[activeKey].aura = 0;
        next[activeKey].iris = 0;
        next[activeKey].depth = 0;
      }
      saveParams(next);
      return next;
    });
    // Yair's presets also snap the motion back to his standard expand/contract.
    // Only Timothy's block leaves motion untouched, so it stays free to play with.
    if (isYair) {
      const ym = { ...MOTION_PRESETS['Yair default'] };
      savePulse(ym);
      setPulse(ym);
    }
  };

  // Save the look you're editing (idle or talking) as a named, state-tagged preset.
  const saveCurrent = () => {
    const nm = presetName.trim();
    if (!nm || editTab === 'pulse') return;
    const st = activeKey;
    const entry: SavedPreset = {
      id: String(Date.now()),
      name: nm,
      state: st,
      params: JSON.parse(JSON.stringify(params[st])),
    };
    setSaved((prev) => {
      const next = [...prev.filter((p) => !(p.name === nm && p.state === st)), entry];
      saveSavedList(next);
      return next;
    });
    setPresetName('');
  };
  const applySaved = (p: SavedPreset) => {
    setEditTab(p.state);
    setState(p.state === 'idle' ? 'idle' : 'coach');
    setParams((prev) => {
      const next: OrbStates = JSON.parse(JSON.stringify(prev));
      next[p.state] = JSON.parse(JSON.stringify(p.params));
      saveParams(next);
      return next;
    });
  };
  const deleteSaved = (id: string) => {
    setSaved((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveSavedList(next);
      return next;
    });
  };
  const copySaved = (p: SavedPreset) => {
    const body = Object.entries(p.params)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    const line = `'${p.name}': { ${body} }, // ${p.state === 'talk' ? 'talking' : 'idle'} look`;
    void navigator.clipboard?.writeText(line);
  };

  const A = params[activeKey];

  return (
    <div className="ot-workspace">
      {(renderPreview ?? ((p) => <HomeBarPreview {...p} />))({
        orbState: state,
        orbStyle: style,
        params,
        pulse,
        mic,
        screenBg: BGS[bg],
        bgKey: bg,
        barStyle,
        iconLeft: leftOn,
        iconRight: rightOn,
      })}

      <div className="ot-panel">
        <div className="ot-row">
          <span className="ot-lab">Background</span>
          {(['light', 'blue', 'yellow', 'dark'] as const).map((k) => (
            <button key={k} className={`ot-btn${bg === k ? 'on' : ''}`} onClick={() => setBg(k)}>
              {k === 'light'
                ? 'Light'
                : k === 'blue'
                  ? 'App blue'
                  : k === 'yellow'
                    ? 'App yellow'
                    : 'Dark'}
            </button>
          ))}
        </div>
        <div className="ot-row">
          <span className="ot-lab">Bar</span>
          {(['white', 'glass', 'floating'] as const).map((s) => (
            <button
              key={s}
              className={`ot-btn${barStyle === s ? 'on' : ''}`}
              style={
                barStyle === s
                  ? {
                      background: 'rgb(var(--color-primary))',
                      color: '#fff',
                      borderColor: 'transparent',
                    }
                  : undefined
              }
              onClick={() => setBarStyle(s)}
            >
              {s === 'white' ? 'White' : s === 'glass' ? 'Glass' : 'Floating'}
            </button>
          ))}
        </div>
        <div className="ot-row">
          <span className="ot-lab">Orb icons</span>
          {(
            [
              ['Chat (left)', leftOn, () => setLeftOn((v) => !v)],
              ['Mic (right)', rightOn, () => setRightOn((v) => !v)],
            ] as const
          ).map(([lab, on, toggle]) => (
            <button
              key={lab}
              className={`ot-btn${on ? 'on' : ''}`}
              style={
                on
                  ? {
                      background: 'rgb(var(--color-primary))',
                      color: '#fff',
                      borderColor: 'transparent',
                    }
                  : undefined
              }
              onClick={toggle}
            >
              {lab}
            </button>
          ))}
        </div>
        <div className="ot-row">
          <span className="ot-lab">State</span>
          {(['idle', 'coach', 'user'] as const).map((k) => (
            <button
              key={k}
              className={`ot-btn${state === k ? 'on' : ''}`}
              onClick={() => pickState(k)}
            >
              {k === 'idle' ? 'Idle' : k === 'coach' ? 'Coach talking' : 'User talking'}
            </button>
          ))}
          <button className={`ot-btn${micOn ? 'on' : ''}`} onClick={toggleMic}>
            {micOn ? 'Mic on (stop)' : 'Use my mic'}
          </button>
        </div>
        <div className="ot-row">
          <span className="ot-lab">Talk style</span>
          {(['full', 'directional'] as const).map((k) => (
            <button
              key={k}
              className={`ot-btn${style === k ? 'on' : ''}`}
              onClick={() => setStyle(k)}
            >
              {k === 'full' ? 'Full circle' : 'Directional'}
            </button>
          ))}
        </div>
        <div className="ot-row">
          <span className="ot-lab">Edit</span>
          {(
            [
              ['idle', 'Idle look'],
              ['talk', 'Talking look'],
              ['pulse', 'Pulse'],
            ] as [EditTab, string][]
          ).map(([k, lbl]) => (
            <button
              key={k}
              className={`ot-btn${editTab === k ? 'on' : ''}`}
              onClick={() => pickEdit(k)}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="ot-hdr">Presets</div>
        <div className="ot-row">
          <span className="ot-lab">Author</span>
          {Object.keys(AUTHOR_PRESETS).map((au) => (
            <button
              key={au}
              className={`ot-btn${author === au ? 'on' : ''}`}
              onClick={() => setAuthor(au)}
            >
              {au}
            </button>
          ))}
        </div>
        <div className="ot-row">
          <span className="ot-lab" />
          {Object.keys(AUTHOR_PRESETS[author] ?? {}).map((name) => (
            <button key={name} className="ot-btn" onClick={() => applyPreset(name)}>
              {name}
            </button>
          ))}
          <button className="ot-btn" onClick={() => setParams(resetParams())}>
            Reset
          </button>
        </div>
        <div className="ot-row">
          <span className="ot-lab">Save as</span>
          <input
            className="ot-input"
            value={presetName}
            placeholder={editTab === 'pulse' ? 'Switch to a look to save' : 'Preset name'}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveCurrent();
            }}
            disabled={editTab === 'pulse'}
          />
          <button
            className="ot-btn"
            onClick={saveCurrent}
            disabled={editTab === 'pulse' || !presetName.trim()}
          >
            Save {activeKey === 'talk' ? 'talking' : 'idle'} look
          </button>
        </div>
        {(['idle', 'talk'] as const).map((gk) => {
          const items = saved.filter((p) => p.state === gk);
          if (!items.length) return null;
          return (
            <div className="ot-row" key={gk}>
              <span className="ot-lab">{gk === 'idle' ? 'Idle saved' : 'Talking saved'}</span>
              {items.map((p) => (
                <span key={p.id} className="ot-chip">
                  <button
                    className="ot-chip-name"
                    onClick={() => applySaved(p)}
                    title="Apply this look"
                  >
                    {p.name}
                  </button>
                  <button
                    className="ot-chip-x"
                    onClick={() => copySaved(p)}
                    title="Copy line for orbPresets.ts"
                  >
                    ⧉
                  </button>
                  <button className="ot-chip-x" onClick={() => deleteSaved(p.id)} title="Delete">
                    ×
                  </button>
                </span>
              ))}
            </div>
          );
        })}
        <div className="ot-row">
          <span className="ot-lab" />
          <span style={{ fontSize: 11, color: '#8a92a8' }}>
            {editTab === 'pulse'
              ? 'Two motion layers you can tune apart. The disc: Base size, Extra pulse, Pulse speed. The outer membrane: Membrane breathe and Membrane speed (its own tempo). Set Orb expand to 0 to keep the disc perfectly stable and let only the membrane and inner light move.'
              : `Editing the ${activeKey === 'talk' ? 'Talking' : 'Idle'} look. Click a half in Idle to toggle it on / off. Name it and Save to keep it as a preset.`}
          </span>
        </div>

        {editTab !== 'pulse' ? (
          <>
            <div className="ot-hdr">Orb (the glass button)</div>
            {GLASS_SLIDERS.map((s) => (
              <div className="ot-sl" key={s.k}>
                <span className="ot-lab">{s.label}</span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  value={A[s.k]}
                  onChange={(e) => setP(s.k, Number(e.target.value))}
                />
                <span className="ot-val">{A[s.k]}</span>
              </div>
            ))}
            <div className="ot-hdr">Inner light (the Siri blob)</div>
            {LIGHT_SLIDERS.map((s) => (
              <div className="ot-sl" key={s.k}>
                <span className="ot-lab">{s.label}</span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  value={A[s.k]}
                  onChange={(e) => setP(s.k, Number(e.target.value))}
                />
                <span className="ot-val">{A[s.k]}</span>
              </div>
            ))}
            <div className="ot-hdr">Depth &amp; aura</div>
            {DEPTH_SLIDERS.map((s) => (
              <div className="ot-sl" key={s.k}>
                <span className="ot-lab">{s.label}</span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  value={A[s.k]}
                  onChange={(e) => setP(s.k, Number(e.target.value))}
                />
                <span className="ot-val">{A[s.k]}</span>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="ot-hdr">Pulse (expand + breathe while talking)</div>
            <div className="ot-row">
              <span className="ot-lab">Motion</span>
              {Object.keys(MOTION_PRESETS).map((name) => (
                <button key={name} className="ot-btn" onClick={() => applyMotion(name)}>
                  {name}
                </button>
              ))}
            </div>
            {PULSE_SLIDERS.map((s) => (
              <div className="ot-sl" key={s.k}>
                <span className="ot-lab">{s.label}</span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  value={pulse[s.k]}
                  onChange={(e) => setPulseP(s.k, Number(e.target.value))}
                />
                <span className="ot-val">{pulse[s.k]}</span>
              </div>
            ))}
          </>
        )}
      </div>

      <style>{OT_CSS}</style>
    </div>
  );
}

const OT_CSS = `
.ot-workspace{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:center;gap:40px;color:#e8e8ee;font-family:'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.ot-root{--D:172px;color:#e8e8ee;font-family:'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;flex-direction:column;align-items:center;gap:18px;padding:8px}
.ot-stage{width:min(380px,100%);height:302px;border-radius:30px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:46px;overflow:hidden;box-shadow:0 18px 50px rgba(20,30,60,.20), inset 0 0 0 1px rgba(255,255,255,.7)}
.ot-panel{width:min(520px,100%);display:flex;flex-direction:column;gap:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:16px 18px;box-sizing:border-box}
.ot-row{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
.ot-lab{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#7a7c88;min-width:74px}
.ot-btn{padding:7px 13px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#e8e8ee;font-size:12.5px;cursor:pointer}
.ot-btn.on{background:#fff;color:#15151c;border-color:#fff;font-weight:600}
.ot-btn:disabled{opacity:.4;cursor:default}
.ot-input{padding:6px 11px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#e8e8ee;font-size:12.5px;min-width:130px}
.ot-input:disabled{opacity:.4}
.ot-chip{display:inline-flex;align-items:center;gap:0;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);overflow:hidden}
.ot-chip-name{padding:6px 11px;background:transparent;border:none;color:#e8e8ee;font-size:12.5px;cursor:pointer}
.ot-chip-name:hover{background:rgba(255,255,255,.12)}
.ot-chip-x{padding:6px 8px;background:transparent;border:none;border-left:1px solid rgba(255,255,255,.12);color:#aeb2c2;font-size:12px;cursor:pointer}
.ot-chip-x:hover{color:#fff;background:rgba(255,255,255,.12)}
.ot-hdr{font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:#c7cbe0;font-weight:700;margin:8px 0 2px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08)}
.ot-sl{display:flex;align-items:center;gap:12px}
.ot-sl .ot-lab{min-width:104px}
.ot-sl input{flex:1;accent-color:#5b8cff;height:4px}
.ot-val{font-size:12px;color:#cdd0db;min-width:44px;text-align:right;font-variant-numeric:tabular-nums}
`;
