import { useEffect, useRef, useState } from 'react';
import { type OrbMic, type OrbStateSel } from '@/components/orb/Orb';
import {
  DEFAULT_PARAMS,
  DEFAULT_PULSE,
  BEAT3_PULSE,
  type OrbParams,
  type PulseParams,
} from '@/components/orb/orbConfig';
import { HomeBarPreview } from './HomeBarPreview';

/**
 * Orb states page: the four orb states the app actually uses, all on one screen,
 * each on the live Timothy menu bar with its background, each with its full
 * control stack beneath and a copy-values button.
 *
 * The four states each hold their OWN look + pulse, so the big talking orb and
 * the small talking orb can be tuned independently even though the app shares
 * one "talk" look today. Seeded from the canonical orbConfig defaults.
 */

// ---- The control lists, mirrored exactly from OrbTuner (same order/ranges) ----
const GLASS_SLIDERS = [
  { k: 'glass', label: 'Translucency', min: 0, max: 100 },
  { k: 'blur', label: 'Frost blur', min: 0, max: 100 },
  { k: 'hi', label: 'Highlight', min: 0, max: 100 },
  { k: 'rim', label: 'Rim', min: 0, max: 100 },
  { k: 'body', label: 'Body tone', min: 0, max: 100 },
] as const;
const LIGHT_SLIDERS = [
  { k: 'glow', label: 'Glow size', min: 50, max: 180 },
  { k: 'bright', label: 'Brightness', min: 60, max: 160 },
  { k: 'speed', label: 'Speed', min: 10, max: 100 },
  { k: 'grad', label: 'Gradient depth', min: 0, max: 100 },
  { k: 'core', label: 'Core size', min: 20, max: 100 },
  { k: 'spread', label: 'Particle spread', min: 12, max: 60 },
  { k: 'pglow', label: 'Particle glow', min: 0, max: 100 },
  { k: 'rand', label: 'Randomness', min: 0, max: 100 },
] as const;
const DEPTH_SLIDERS = [
  { k: 'aura', label: 'Outer aura', min: 0, max: 100 },
  { k: 'iris', label: 'Iridescent rim', min: 0, max: 100 },
  { k: 'depth', label: 'Glass depth', min: 0, max: 100 },
] as const;
const PULSE_SLIDERS = [
  { k: 'reactLight', label: 'Light reactivity', min: 0, max: 100 },
  { k: 'reactDisc', label: 'Disc reactivity', min: 0, max: 100 },
  { k: 'reactAura', label: 'Aura reactivity', min: 0, max: 100 },
  { k: 'reactCore', label: 'Core reactivity', min: 0, max: 100 },
  { k: 'size', label: 'Base size', min: 0, max: 40 },
  { k: 'amt', label: 'Extra pulse', min: 0, max: 100 },
  { k: 'speed', label: 'Pulse speed', min: 0, max: 100 },
  { k: 'orbAmt', label: 'Orb expand', min: 0, max: 100 },
  { k: 'mem', label: 'Membrane breathe', min: 0, max: 100 },
  { k: 'memSpeed', label: 'Membrane speed', min: 0, max: 100 },
] as const;

const BGS: Record<string, string> = {
  light: '#f4f6fb',
  blue: 'linear-gradient(to top, rgba(19,91,236,0.72) 0%, rgba(123,164,236,0.34) 50%, rgba(216,228,248,0.82) 100%), #ffffff',
  yellow:
    'linear-gradient(to top, rgba(253,208,23,0.72) 0%, rgba(250,228,140,0.34) 50%, rgba(244,241,226,0.82) 100%), #ffffff',
  dark: 'linear-gradient(180deg,#0b1020,#161d33)',
};

type BgKey = 'light' | 'blue' | 'yellow' | 'dark';

interface StateDef {
  id: string;
  title: string;
  sub: string;
  sel: OrbStateSel; // idle | coach | user
  size: number;
  centered: boolean; // big body orb vs notch orb
  bg: BgKey;
  look: OrbParams;
  pulse: PulseParams;
  mic: boolean; // this state reacts to the live mic
}

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

function initialStates(): StateDef[] {
  return [
    {
      id: 'idle',
      title: 'Idle (docked)',
      sub: 'The resting orb in the bar. Not talking.',
      sel: 'idle',
      size: 91,
      centered: false,
      bg: 'blue',
      look: clone(DEFAULT_PARAMS.idle),
      pulse: clone(DEFAULT_PULSE),
      mic: false,
    },
    {
      id: 'talk-big',
      title: 'Coach talking, big (beat 2)',
      sub: 'The greeting orb blooming full-screen while the coach speaks.',
      sel: 'coach',
      size: 168,
      centered: true,
      bg: 'blue',
      look: clone(DEFAULT_PARAMS.talk),
      pulse: clone(BEAT3_PULSE),
      mic: false,
    },
    {
      id: 'talk-small',
      title: 'Coach talking, small (bar)',
      sub: 'The regular coach voice in the home bar notch.',
      sel: 'coach',
      size: 91,
      centered: false,
      bg: 'blue',
      look: clone(DEFAULT_PARAMS.talk),
      pulse: clone(DEFAULT_PULSE),
      mic: false,
    },
    {
      id: 'mic-pulse',
      title: 'Your turn, mic pulse',
      sub: 'The orb reacting to your microphone while you talk.',
      sel: 'user',
      size: 91,
      centered: false,
      bg: 'yellow',
      look: clone(DEFAULT_PARAMS.talk),
      pulse: clone(DEFAULT_PULSE),
      mic: true,
    },
  ];
}

const STORE = 'gg-flow-builder-v18:orb-states-v1';
function load(): StateDef[] {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return initialStates();
    const saved = JSON.parse(raw) as StateDef[];
    // Merge onto the fresh defs so new fields survive a schema bump.
    const base = initialStates();
    return base.map((b) => {
      const s = saved.find((x) => x.id === b.id);
      return s
        ? {
            ...b,
            look: { ...b.look, ...s.look },
            pulse: { ...b.pulse, ...s.pulse },
            bg: s.bg ?? b.bg,
          }
        : b;
    });
  } catch {
    return initialStates();
  }
}

// ---- Live mic: drives OrbMic ref for the mic-pulse state ----
function useMic() {
  const ref = useRef<OrbMic>({ on: false, amp: 0 });
  const [on, setOn] = useState(false);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef<number | undefined>(undefined);
  const ac = useRef<AudioContext | null>(null);

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    if (raf.current) cancelAnimationFrame(raf.current);
    ac.current?.close().catch(() => {});
    ref.current = { on: false, amp: 0 };
    setOn(false);
  };
  const toggle = async () => {
    if (on) return stop();
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ac.current = new AC();
      const src = ac.current.createMediaStreamSource(s);
      const an = ac.current.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      const loop = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        const amp = Math.min(1, rms * 3.4);
        ref.current = { on: true, amp: ref.current.amp * 0.7 + amp * 0.3 };
        raf.current = requestAnimationFrame(loop);
      };
      loop();
      setOn(true);
    } catch {
      /* denied */
    }
  };
  useEffect(() => () => stop(), []);
  return { ref, on, toggle };
}

const STILL: { current: OrbMic } = { current: { on: false, amp: 0 } };

function serialize(s: StateDef): string {
  const lk = (arr: readonly { k: string }[]) =>
    arr.map((x) => `${x.k}: ${(s.look as Record<string, number>)[x.k]}`).join(', ');
  const pk = PULSE_SLIDERS.map((x) => `${x.k}: ${(s.pulse as Record<string, number>)[x.k]}`).join(
    ', ',
  );
  return (
    `// ${s.title}  (state: ${s.sel}, size ${s.size}, bg ${s.bg})\n` +
    `look: { ${lk(GLASS_SLIDERS)}, ${lk(LIGHT_SLIDERS)}, ${lk(DEPTH_SLIDERS)} },\n` +
    `pulse: { ${pk} },`
  );
}

export function OrbStates() {
  const [states, setStates] = useState<StateDef[]>(load);
  const [copied, setCopied] = useState<string>('');
  const mic = useMic();

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(states));
    } catch {
      /* ignore */
    }
  }, [states]);

  const patch = (id: string, fn: (s: StateDef) => StateDef) =>
    setStates((prev) => prev.map((s) => (s.id === id ? fn(s) : s)));

  const setLook = (id: string, k: string, v: number) =>
    patch(id, (s) => ({ ...s, look: { ...s.look, [k]: v } }));
  const setPulse = (id: string, k: string, v: number) =>
    patch(id, (s) => ({ ...s, pulse: { ...s.pulse, [k]: v } }));
  const setBg = (id: string, bg: BgKey) => patch(id, (s) => ({ ...s, bg }));
  const resetOne = (id: string) =>
    setStates((prev) =>
      prev.map((s) => (s.id === id ? (initialStates().find((x) => x.id === id) as StateDef) : s)),
    );

  const copy = async (s: StateDef) => {
    try {
      await navigator.clipboard.writeText(serialize(s));
      setCopied(s.id);
      setTimeout(() => setCopied(''), 1400);
    } catch {
      /* ignore */
    }
  };
  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(states.map(serialize).join('\n\n'));
      setCopied('all');
      setTimeout(() => setCopied(''), 1400);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="os-wrap">
      <style>{OS_CSS}</style>
      <div className="os-head">
        <div>
          <div className="os-title">Orb states</div>
          <div className="os-desc">
            The four states the app uses, each on the live menu bar. Tune any one, then copy its
            values. Idle and coach talking sit on blue, your turn sits on yellow. Seeded from the
            app defaults.
          </div>
        </div>
        <button className="os-btn os-btn-primary" onClick={copyAll}>
          {copied === 'all' ? 'Copied' : 'Copy all four'}
        </button>
      </div>

      {states.map((s) => (
        <section key={s.id} className="os-card">
          <div className="os-preview">
            <HomeBarPreview
              orbState={s.sel}
              orbStyle="full"
              params={{ idle: s.look, talk: s.look }}
              pulse={s.pulse}
              mic={s.mic ? mic.ref : STILL}
              screenBg={BGS[s.bg]}
              bgKey={s.bg}
              orbSize={s.size}
              centered={s.centered}
              label={s.title}
            />
          </div>

          <div className="os-controls">
            <div className="os-crow">
              <div>
                <div className="os-ctitle">{s.title}</div>
                <div className="os-csub">{s.sub}</div>
              </div>
              <div className="os-actions">
                {s.mic && (
                  <button className={`os-btn ${mic.on ? 'os-btn-live' : ''}`} onClick={mic.toggle}>
                    {mic.on ? 'Mic on' : 'Use my mic'}
                  </button>
                )}
                <button className="os-btn" onClick={() => resetOne(s.id)}>
                  Reset
                </button>
                <button className="os-btn os-btn-primary" onClick={() => copy(s)}>
                  {copied === s.id ? 'Copied' : 'Copy values'}
                </button>
              </div>
            </div>

            <div className="os-bgrow">
              <span className="os-lbl">Background</span>
              {(['blue', 'yellow', 'light', 'dark'] as BgKey[]).map((b) => (
                <button
                  key={b}
                  className={`os-chip ${s.bg === b ? 'on' : ''}`}
                  onClick={() => setBg(s.id, b)}
                >
                  {b}
                </button>
              ))}
            </div>

            <Group
              title="Orb (the glass button)"
              sliders={GLASS_SLIDERS}
              vals={s.look}
              onChange={(k, v) => setLook(s.id, k, v)}
            />
            <Group
              title="Inner light (the Siri blob)"
              sliders={LIGHT_SLIDERS}
              vals={s.look}
              onChange={(k, v) => setLook(s.id, k, v)}
            />
            <Group
              title="Depth & aura"
              sliders={DEPTH_SLIDERS}
              vals={s.look}
              onChange={(k, v) => setLook(s.id, k, v)}
            />
            <Group
              title="Pulse (expand + breathe while talking)"
              sliders={PULSE_SLIDERS}
              vals={s.pulse}
              onChange={(k, v) => setPulse(s.id, k, v)}
            />
          </div>
        </section>
      ))}
    </div>
  );
}

function Group({
  title,
  sliders,
  vals,
  onChange,
}: {
  title: string;
  sliders: readonly { k: string; label: string; min: number; max: number }[];
  vals: Record<string, number>;
  onChange: (k: string, v: number) => void;
}) {
  return (
    <div className="os-group">
      <div className="os-gtitle">{title}</div>
      {sliders.map((sl) => (
        <div className="os-sl" key={sl.k}>
          <span className="os-slab">{sl.label}</span>
          <input
            type="range"
            min={sl.min}
            max={sl.max}
            value={vals[sl.k] ?? 0}
            onChange={(e) => onChange(sl.k, Number(e.target.value))}
          />
          <span className="os-sval">{vals[sl.k] ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

const OS_CSS = `
.os-wrap{ width:100%; max-width:1180px; margin:0 auto; color:#e7ebf5; font-family:Urbanist,-apple-system,sans-serif; padding-bottom:80px; }
.os-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin:8px 0 24px; }
.os-title{ font-size:22px; font-weight:800; letter-spacing:-.01em; }
.os-desc{ font-size:13px; line-height:1.5; color:#98a1b8; max-width:62ch; margin-top:6px; }
.os-card{ display:grid; grid-template-columns:360px 1fr; gap:28px; align-items:start;
  background:#12151f; border:1px solid #222838; border-radius:20px; padding:22px; margin-bottom:22px; }
.os-preview{ position:sticky; top:16px; display:flex; justify-content:center; }
.os-controls{ min-width:0; }
.os-crow{ display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:14px; flex-wrap:wrap; }
.os-ctitle{ font-size:16px; font-weight:800; }
.os-csub{ font-size:12.5px; color:#98a1b8; margin-top:3px; }
.os-actions{ display:flex; gap:8px; flex-wrap:wrap; }
.os-btn{ border:1px solid #2c3446; background:#1b2130; color:#dbe2f0; border-radius:999px;
  padding:7px 14px; font-size:12.5px; font-weight:700; cursor:pointer; font-family:inherit; }
.os-btn:hover{ border-color:#3a4459; }
.os-btn-primary{ background:#2f6bff; border-color:#2f6bff; color:#fff; }
.os-btn-live{ background:#e0b400; border-color:#e0b400; color:#1a1400; }
.os-bgrow{ display:flex; align-items:center; gap:8px; margin-bottom:18px; }
.os-lbl{ font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#8a92a8; margin-right:4px; }
.os-chip{ border:1px solid #2c3446; background:#1b2130; color:#c3ccdd; border-radius:999px;
  padding:5px 12px; font-size:12px; font-weight:700; cursor:pointer; text-transform:capitalize; font-family:inherit; }
.os-chip.on{ background:#2f6bff; border-color:#2f6bff; color:#fff; }
.os-group{ margin-bottom:16px; }
.os-gtitle{ font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.07em; color:#7c86a0;
  border-bottom:1px solid #222838; padding-bottom:6px; margin-bottom:10px; }
.os-sl{ display:grid; grid-template-columns:132px 1fr 38px; align-items:center; gap:12px; padding:3px 0; }
.os-slab{ font-size:12.5px; color:#c3ccdd; }
.os-sl input[type=range]{ width:100%; accent-color:#5b8cff; height:4px; }
.os-sval{ font-size:12.5px; font-variant-numeric:tabular-nums; text-align:right; color:#e7ebf5; font-weight:700; }
@media (max-width:820px){ .os-card{ grid-template-columns:1fr; } .os-preview{ position:static; } }
`;
