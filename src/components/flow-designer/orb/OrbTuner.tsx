import { useEffect, useRef, useState } from 'react';
import { IconChatText, IconMicMuted } from '@/components/icons';
import {
  AUTHOR_PRESETS,
  loadParams,
  resetParams,
  saveParams,
  type OrbParams,
  type OrbStates,
} from '../orb/orbPresets';

// The Orb: a self-contained canvas-2D Siri-style glass button with a full tuner.
// Idle = the resting two-half orb. Talking = either a full-circle merge (speaker
// colour) or a directional pulse (blue left when the AI speaks, yellow right when
// the user speaks). Everything is driven by two editable param sets (idle / talk)
// that persist in localStorage; named presets live in orbPresets.ts (in git).

type Rgb = [number, number, number];
const BLUE: Rgb[] = [
  [12, 38, 110],
  [30, 96, 235],
  [110, 170, 255],
  [236, 244, 255],
  [120, 104, 255],
];
const GOLD: Rgb[] = [
  [110, 60, 8],
  [220, 150, 18],
  [255, 200, 66],
  [255, 246, 210],
  [255, 150, 50],
];
const GRAY: Rgb[] = [
  [120, 128, 140],
  [150, 158, 170],
  [192, 198, 208],
  [228, 231, 237],
  [160, 168, 180],
];

const BGS: Record<string, string> = {
  light: 'radial-gradient(120% 100% at 50% 0%, #ffffff 0%, #eef2f8 52%, #e2e8f1 100%)',
  blue: 'linear-gradient(to top, rgba(19,91,236,0.72) 0%, rgba(123,164,236,0.34) 50%, rgba(216,228,248,0.82) 100%), #ffffff',
  yellow: 'linear-gradient(to top, rgba(253,208,23,0.74) 0%, rgba(250,228,140,0.34) 50%, rgba(244,241,226,0.82) 100%), #ffffff',
  dark: 'radial-gradient(130% 100% at 50% 0%, #1b2030 0%, #10131c 55%, #0a0c12 100%)',
};

type StateSel = 'idle' | 'coach' | 'user';
type TalkStyle = 'full' | 'directional';

interface Blob {
  ci: number;
  seed: number;
  sz: number;
  rspeed: number;
}
function makeBlobs(): Blob[] {
  const plan = [0, 1, 2, 4, 1, 2, 3, 1];
  return plan.map((ci, i) => ({
    ci,
    seed: i * 9.1 + 2.3,
    sz: 0.42 + 0.16 * ((i * 31) % 5) / 5,
    rspeed: 0.6 + (((i * 37) % 9) / 9) * 0.9,
  }));
}

function makeNoise(seed: number): (x: number, y: number) => number {
  const grad = [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let n = seed >>> 0;
  for (let i = 255; i > 0; i--) {
    n = (n * 1664525 + 1013904223) >>> 0;
    const j = n % (i + 1);
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  const corner = (gx: number, gy: number, x: number, y: number): number => {
    let tt = 0.5 - x * x - y * y;
    if (tt < 0) return 0;
    tt *= tt;
    return tt * tt * (gx * x + gy * y);
  };
  return (xin: number, yin: number): number => {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const g0 = grad[perm[ii + perm[jj]] & 7];
    const g1 = grad[perm[ii + i1 + perm[jj + j1]] & 7];
    const g2 = grad[perm[ii + 1 + perm[jj + 1]] & 7];
    return 70 * (corner(g0[0], g0[1], x0, y0) + corner(g1[0], g1[1], x1, y1) + corner(g2[0], g2[1], x2, y2));
  };
}

const rgba = (a: Rgb, al: number): string => `rgba(${a[0]},${a[1]},${a[2]},${al})`;

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
  { k: 'pulse', label: 'Pulse (talking)', min: 0, max: 100 },
];

interface LiveCfg {
  params: OrbStates;
  state: StateSel;
  style: TalkStyle;
  leftOn: boolean;
  rightOn: boolean;
}

export function OrbTuner() {
  const [params, setParams] = useState<OrbStates>(() => loadParams());
  const [state, setState] = useState<StateSel>('idle');
  const [style, setStyle] = useState<TalkStyle>('full');
  const [bg, setBg] = useState<string>('light');
  const [author, setAuthor] = useState<string>(Object.keys(AUTHOR_PRESETS)[0] ?? 'Yair');
  const [leftOn, setLeftOn] = useState(true);
  const [rightOn, setRightOn] = useState(true);
  const [micOn, setMicOn] = useState(false);

  const activeKey: keyof OrbStates = state === 'idle' ? 'idle' : 'talk';

  const orbRef = useRef<HTMLDivElement>(null);
  const leftHalfRef = useRef<HTMLDivElement>(null);
  const rightHalfRef = useRef<HTMLDivElement>(null);
  const leftCv = useRef<HTMLCanvasElement>(null);
  const rightCv = useRef<HTMLCanvasElement>(null);
  const fullCv = useRef<HTMLCanvasElement>(null);

  const cfg = useRef<LiveCfg>({ params, state, style, leftOn, rightOn });
  cfg.current = { params, state, style, leftOn, rightOn };
  const mic = useRef<{ on: boolean; amp: number }>({ on: false, amp: 0 });
  mic.current.on = micOn;

  // Animation loop, mounted once. Reads the live cfg/mic refs each frame.
  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;
    const noise = makeNoise(701);
    const blobs = makeBlobs();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let last = 0;
    let tL = 0;
    let tR = 0;
    let tF = 0;

    const setVar = (name: string, v: string) => orb.style.setProperty(name, v);

    const drawHalf = (
      cv: HTMLCanvasElement | null,
      side: 'left' | 'right',
      dt: number,
    ): number => {
      if (!cv) return 0;
      const ctx = cv.getContext('2d');
      if (!ctx) return 0;
      const d = cv.clientWidth;
      const h = cv.clientHeight;
      if (!d) return 0;
      if (cv.width !== Math.round(d * dpr)) {
        cv.width = Math.round(d * dpr);
        cv.height = Math.round(h * dpr);
      }
      const c = cfg.current;
      const talking = c.state !== 'idle';
      const activeSide = c.state === 'coach' ? 'left' : c.state === 'user' ? 'right' : null;
      const isActive = talking && c.style === 'directional' && side === activeSide;
      const on = talking ? true : side === 'left' ? c.leftOn : c.rightOn;
      const pal = on ? (side === 'left' ? BLUE : GOLD) : GRAY;
      const P = isActive ? c.params.talk : c.params.idle;
      const offMul = on ? 1 : 0.5;
      const m = mic.current;
      const micF = isActive && m.on ? 0.6 + m.amp * 0.55 : 1;
      const em = isActive ? 1.25 * micF : 1;
      const glow = (P.glow / 100) * offMul * em;
      const bright = (P.bright / 100) * offMul;
      const grad = P.grad / 100;
      const coreS = P.core / 100;
      const spread = (P.spread / 100) * em;
      const pglow = P.pglow / 100;
      const rand = P.rand / 100;
      const sp = 0.12 + (P.speed / 100) * 0.6;
      const time = (side === 'left' ? (tL += dt * sp) : (tR += dt * sp));
      const W = cv.width;
      const CH = cv.height;
      const gp = (orb.clientWidth || 172) * 0.06 * dpr;
      const ocx = side === 'left' ? W + gp / 2 : -gp / 2;
      const ocy = CH / 2;
      const R = CH / 2;
      const cpulse = 0.92 + 0.08 * Math.sin(time * 0.9);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, CH);
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'none';
      const bgGrad = ctx.createRadialGradient(ocx, ocy, 0, ocx, ocy, R * 0.98);
      bgGrad.addColorStop(0, `rgba(255,255,255,${0.24 * cpulse * bright})`);
      bgGrad.addColorStop(0.26, rgba(pal[2], 0.44 * grad * bright));
      bgGrad.addColorStop(0.55, rgba(pal[1], 0.44 * grad * bright));
      bgGrad.addColorStop(0.84, rgba(pal[0], 0.48 * grad * bright));
      bgGrad.addColorStop(1, rgba(pal[0], 0));
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(ocx, ocy, R * 0.99, 0, 6.2832);
      ctx.fill();
      ctx.filter = `blur(${0.06 * R}px)`;
      for (const b of blobs) {
        const bt = time * (1 + (b.rspeed - 1) * rand);
        const nx = noise(b.seed + bt * 0.4, 0) + 0.5 * noise(b.seed * 2 - bt * 0.6, 1.3);
        const ny = noise(0, b.seed + bt * 0.4) + 0.5 * noise(1.7, b.seed * 2 + bt * 0.36);
        const drift = R * spread * (0.85 + rand * 0.6);
        const bx = ocx + nx * drift;
        const by = ocy + ny * drift;
        const radv = R * b.sz * (0.9 + 0.14 * noise(b.seed * 3, bt * 0.4)) * (0.5 + 0.9 * glow) * (0.7 + spread);
        const col = pal[b.ci];
        const al = (0.12 + 0.34 * pglow) * bright;
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, radv);
        g.addColorStop(0, rgba(col, al));
        g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, by, radv, 0, 6.2832);
        ctx.fill();
      }
      const cr = R * coreS;
      const cg = ctx.createRadialGradient(ocx, ocy, 0, ocx, ocy, cr);
      cg.addColorStop(0, `rgba(255,255,255,${cpulse * 0.55 * bright})`);
      cg.addColorStop(0.32, rgba(pal[3], 0.42 * bright));
      cg.addColorStop(1, rgba(pal[3], 0));
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(ocx, ocy, cr, 0, 6.2832);
      ctx.fill();
      ctx.filter = 'none';
      return isActive ? em : 0;
    };

    const drawFull = (cv: HTMLCanvasElement | null, dt: number): void => {
      if (!cv) return;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      const d = cv.clientWidth;
      if (!d) return;
      if (cv.width !== Math.round(d * dpr)) {
        cv.width = Math.round(d * dpr);
        cv.height = Math.round(d * dpr);
      }
      const c = cfg.current;
      const W = cv.width;
      if (!(c.state !== 'idle' && c.style === 'full')) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, W);
        return;
      }
      const pal = c.state === 'coach' ? BLUE : GOLD;
      const P = c.params.talk;
      const m = mic.current;
      const micF = m.on ? 0.6 + m.amp * 0.55 : 1;
      const glow = (P.glow / 100) * 1.2 * micF;
      const bright = P.bright / 100;
      const grad = P.grad / 100;
      const coreS = P.core / 100;
      const spread = (P.spread / 100) * 1.2;
      const pglow = P.pglow / 100;
      const rand = P.rand / 100;
      const sp = 0.12 + (P.speed / 100) * 0.6;
      tF += dt * sp;
      const time = tF;
      const cx = W / 2;
      const cy = W / 2;
      const R = W / 2;
      const cpulse = 0.9 + 0.1 * Math.sin(time * 0.9);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, W);
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'none';
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.98);
      bgGrad.addColorStop(0, `rgba(255,255,255,${0.24 * cpulse * bright})`);
      bgGrad.addColorStop(0.26, rgba(pal[2], 0.44 * grad * bright));
      bgGrad.addColorStop(0.55, rgba(pal[1], 0.44 * grad * bright));
      bgGrad.addColorStop(0.84, rgba(pal[0], 0.48 * grad * bright));
      bgGrad.addColorStop(1, rgba(pal[0], 0));
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.98, 0, 6.2832);
      ctx.fill();
      ctx.filter = `blur(${0.06 * R}px)`;
      for (const b of blobs) {
        const bt = time * (1 + (b.rspeed - 1) * rand);
        const nx = noise(b.seed + bt * 0.4, 0) + 0.5 * noise(b.seed * 2 - bt * 0.6, 1.3);
        const ny = noise(0, b.seed + bt * 0.4) + 0.5 * noise(1.7, b.seed * 2 + bt * 0.36);
        const drift = R * spread * (0.85 + rand * 0.6);
        const bx = cx + nx * drift;
        const by = cy + ny * drift;
        const radv = R * b.sz * (0.9 + 0.14 * noise(b.seed * 3, bt * 0.4)) * (0.5 + 0.9 * glow) * (0.7 + spread);
        const col = pal[b.ci];
        const al = (0.12 + 0.34 * pglow) * bright;
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, radv);
        g.addColorStop(0, rgba(col, al));
        g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, by, radv, 0, 6.2832);
        ctx.fill();
      }
      const cr = R * coreS;
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
      cg.addColorStop(0, `rgba(255,255,255,${cpulse * 0.55 * bright})`);
      cg.addColorStop(0.32, rgba(pal[3], 0.42 * bright));
      cg.addColorStop(1, rgba(pal[3], 0));
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, 6.2832);
      ctx.fill();
      ctx.filter = 'none';
    };

    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      const c = cfg.current;
      const m = mic.current;
      const talking = c.state !== 'idle';
      const full = talking && c.style === 'full';
      const aset = talking ? c.params.talk : c.params.idle;
      setVar('--glass', String(aset.glass / 100));
      setVar('--rim', String(aset.rim / 100));
      setVar('--body', String(aset.body / 100));
      setVar('--hi', String(aset.hi / 100));
      setVar('--blur', `${((aset.blur / 100) * 6).toFixed(1)}px`);
      orb.classList.toggle('ot-full', full);
      const t2 = performance.now() / 1000;
      if (full) {
        const p = aset.pulse / 100;
        const micF = m.on ? 0.5 + m.amp * 0.9 : 1;
        const grow = 1 + 0.1 * micF + (0.05 + p * 0.13) * (0.5 + 0.5 * Math.sin(t2 * 2)) * micF;
        orb.style.transform = `scale(${grow.toFixed(3)})`;
      } else {
        orb.style.transform = '';
      }
      const activeSide = c.state === 'coach' ? 'left' : c.state === 'user' ? 'right' : null;
      if (talking && c.style === 'directional' && activeSide) {
        const p = c.params.talk.pulse / 100;
        const micF = m.on ? 0.5 + m.amp * 0.9 : 1;
        const gv = 1 + (0.05 + p * 0.12) * (0.6 + 0.4 * Math.sin(t2 * 2)) * micF;
        if (leftHalfRef.current) leftHalfRef.current.style.transform = activeSide === 'left' ? `scale(${gv.toFixed(3)})` : '';
        if (rightHalfRef.current) rightHalfRef.current.style.transform = activeSide === 'right' ? `scale(${gv.toFixed(3)})` : '';
      } else {
        if (leftHalfRef.current) leftHalfRef.current.style.transform = '';
        if (rightHalfRef.current) rightHalfRef.current.style.transform = '';
      }
      drawHalf(leftCv.current, 'left', dt);
      drawHalf(rightCv.current, 'right', dt);
      drawFull(fullCv.current, dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

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
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
  const applyPreset = (name: string) => {
    const pr = AUTHOR_PRESETS[author]?.[name];
    if (!pr) return;
    setParams((prev) => {
      const next: OrbStates = JSON.parse(JSON.stringify(prev));
      Object.assign(next[activeKey], pr);
      saveParams(next);
      return next;
    });
  };

  const A = params[activeKey];

  return (
    <div className="ot-root">
      <div className="ot-stage" style={{ background: BGS[bg] }}>
        <div ref={orbRef} className="ot-orb">
          <div ref={leftHalfRef} className="ot-half ot-left" onClick={() => setLeftOn((v) => !v)}>
            <canvas ref={leftCv} className="ot-cv" />
            <div className="ot-glass" />
            <div className="ot-spec" />
            <div className="ot-ico">{state === 'idle' && !leftOn ? <IconChatText size={38} /> : null}</div>
          </div>
          <div ref={rightHalfRef} className="ot-half ot-right" onClick={() => setRightOn((v) => !v)}>
            <canvas ref={rightCv} className="ot-cv" />
            <div className="ot-glass" />
            <div className="ot-spec" />
            <div className="ot-ico">{state === 'idle' && !rightOn ? <IconMicMuted size={38} /> : null}</div>
          </div>
          <div className="ot-full-wrap">
            <div className="ot-fullbody" />
            <canvas ref={fullCv} className="ot-cv" />
            <div className="ot-fullglass" />
            <div className="ot-spec" />
          </div>
          <div className="ot-ring" />
        </div>
      </div>

      <div className="ot-panel">
        <div className="ot-row">
          <span className="ot-lab">Background</span>
          {(['light', 'blue', 'yellow', 'dark'] as const).map((k) => (
            <button key={k} className={`ot-btn${bg === k ? ' on' : ''}`} onClick={() => setBg(k)}>
              {k === 'light' ? 'Light' : k === 'blue' ? 'App blue' : k === 'yellow' ? 'App yellow' : 'Dark'}
            </button>
          ))}
        </div>
        <div className="ot-row">
          <span className="ot-lab">State</span>
          {(['idle', 'coach', 'user'] as const).map((k) => (
            <button key={k} className={`ot-btn${state === k ? ' on' : ''}`} onClick={() => setState(k)}>
              {k === 'idle' ? 'Idle' : k === 'coach' ? 'Coach talking' : 'User talking'}
            </button>
          ))}
          <button className={`ot-btn${micOn ? ' on' : ''}`} onClick={toggleMic}>
            {micOn ? 'Mic on (stop)' : 'Use my mic'}
          </button>
        </div>
        <div className="ot-row">
          <span className="ot-lab">Talk style</span>
          {(['full', 'directional'] as const).map((k) => (
            <button key={k} className={`ot-btn${style === k ? ' on' : ''}`} onClick={() => setStyle(k)}>
              {k === 'full' ? 'Full circle' : 'Directional'}
            </button>
          ))}
        </div>
        <div className="ot-row">
          <span className="ot-lab">Presets</span>
          {Object.keys(AUTHOR_PRESETS).map((au) => (
            <button key={au} className={`ot-btn${author === au ? ' on' : ''}`} onClick={() => setAuthor(au)}>
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
          <span className="ot-lab" />
          <span style={{ fontSize: 11, color: '#8a92a8' }}>
            Editing the {state === 'idle' ? 'Idle' : 'Talking'} look. Click a half in Idle to toggle it on / off.
          </span>
        </div>

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
      </div>

      <style>{OT_CSS}</style>
    </div>
  );
}

const OT_CSS = `
.ot-root{--D:172px;color:#e8e8ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;flex-direction:column;align-items:center;gap:18px;padding:8px}
.ot-stage{width:380px;height:302px;border-radius:30px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:46px;overflow:hidden;box-shadow:0 18px 50px rgba(20,30,60,.20), inset 0 0 0 1px rgba(255,255,255,.7)}
.ot-orb{position:relative;width:var(--D);height:var(--D);border-radius:50%;overflow:hidden;--gap:max(5px, calc(var(--D)*0.06));--innerR:calc(var(--D)*0.0494);box-shadow:0 8px 22px rgba(20,30,60,.26), 0 0 24px 2px rgba(175,195,255,.16)}
.ot-orb.ot-full{--gap:0px;--innerR:0px}
.ot-half{position:absolute;top:0;height:100%;width:calc(50% - var(--gap)/2);overflow:hidden;cursor:pointer;background:radial-gradient(125% 125% at 50% 34%, rgba(255,255,255, calc(0.20 + 0.16*(1 - var(--body)))), rgba(255,255,255, calc(0.04 + 0.05*(1 - var(--body)))) 52%, rgba(8,11,22, calc(0.10 + 0.52*var(--body))) 100%)}
.ot-half.ot-left{left:0;border-top-right-radius:var(--innerR);border-bottom-right-radius:var(--innerR);transform-origin:100% 50%}
.ot-half.ot-right{right:0;border-top-left-radius:var(--innerR);border-bottom-left-radius:var(--innerR);transform-origin:0% 50%}
.ot-orb.ot-full .ot-half{opacity:0}
.ot-cv{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.ot-glass{position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:var(--glass);backdrop-filter:blur(var(--blur,0px));-webkit-backdrop-filter:blur(var(--blur,0px));background:radial-gradient(120% 95% at 50% 16%, rgba(255,255,255,.6), rgba(255,255,255,.16) 46%, rgba(255,255,255,0) 72%)}
.ot-spec{position:absolute;left:27%;top:15%;width:32%;height:24%;border-radius:50%;pointer-events:none;opacity:var(--hi,.4);background:radial-gradient(circle, rgba(255,255,255,.92), rgba(255,255,255,0) 70%);mix-blend-mode:screen}
.ot-ico{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:4;color:rgba(40,52,78,.82);pointer-events:none;filter:drop-shadow(0 1px 1px rgba(255,255,255,.55))}
.ot-full-wrap{position:absolute;inset:0;border-radius:50%;overflow:hidden;opacity:0;transition:opacity .3s;pointer-events:none;z-index:3}
.ot-orb.ot-full .ot-full-wrap{opacity:1}
.ot-fullbody{position:absolute;inset:0;border-radius:50%;background:radial-gradient(125% 125% at 50% 40%, rgba(255,255,255, calc(0.20 + 0.16*(1 - var(--body)))), rgba(255,255,255, calc(0.04 + 0.05*(1 - var(--body)))) 52%, rgba(8,11,22, calc(0.10 + 0.52*var(--body))) 100%)}
.ot-fullglass{position:absolute;inset:0;border-radius:50%;opacity:var(--glass);backdrop-filter:blur(var(--blur,0px));-webkit-backdrop-filter:blur(var(--blur,0px));background:radial-gradient(120% 95% at 50% 16%, rgba(255,255,255,.6), rgba(255,255,255,.16) 46%, rgba(255,255,255,0) 72%)}
.ot-ring{position:absolute;inset:0;border-radius:50%;pointer-events:none;z-index:6;box-shadow:inset 0 0 0 1.3px rgba(255,255,255, calc(0.4 + 0.5*var(--rim)))}
.ot-panel{width:520px;max-width:92vw;display:flex;flex-direction:column;gap:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:16px 18px}
.ot-row{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
.ot-lab{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#7a7c88;min-width:74px}
.ot-btn{padding:7px 13px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#e8e8ee;font-size:12.5px;cursor:pointer}
.ot-btn.on{background:#fff;color:#15151c;border-color:#fff;font-weight:600}
.ot-hdr{font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:#c7cbe0;font-weight:700;margin:8px 0 2px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08)}
.ot-sl{display:flex;align-items:center;gap:12px}
.ot-sl .ot-lab{min-width:104px}
.ot-sl input{flex:1;accent-color:#5b8cff;height:4px}
.ot-val{font-size:12px;color:#cdd0db;min-width:44px;text-align:right;font-variant-numeric:tabular-nums}
`;
