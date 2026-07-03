import { useEffect, useRef, type MutableRefObject, type ReactNode } from 'react';
import type { OrbStates, PulseParams } from './orbConfig';

// The reusable animated orb: a canvas-2D Siri-style glass button rendered at any
// size and driven entirely by props (the look, the state, the pulse, the mic).
// Both the tuner stage (big) and the home bar (small) render one of these off the
// same live params, so tuning the orb updates every place it appears.

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

export type OrbStateSel = 'idle' | 'coach' | 'user';
export type OrbTalkStyle = 'full' | 'directional';
export interface OrbMic {
  on: boolean;
  amp: number;
}

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
    sz: 0.42 + (0.16 * ((i * 31) % 5)) / 5,
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
    return (
      70 *
      (corner(g0[0], g0[1], x0, y0) + corner(g1[0], g1[1], x1, y1) + corner(g2[0], g2[1], x2, y2))
    );
  };
}

const rgba = (a: Rgb, al: number): string => `rgba(${a[0]},${a[1]},${a[2]},${al})`;

interface OrbCfg {
  state: OrbStateSel;
  style: OrbTalkStyle;
  params: OrbStates;
  pulse: PulseParams;
  leftOn: boolean;
  rightOn: boolean;
}

interface OrbProps {
  size: number;
  state: OrbStateSel;
  style: OrbTalkStyle;
  params: OrbStates;
  pulse: PulseParams;
  leftOn?: boolean;
  rightOn?: boolean;
  /** Shared mic ref so the orb pulses with the live mic amplitude. */
  mic?: MutableRefObject<OrbMic>;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
  /** Icons shown only when idle and that half is toggled off (the tuner). */
  idleIcons?: { left: ReactNode; right: ReactNode };
  /** Icons always shown on top (the home bar reads as the real button). */
  overlayIcons?: { left: ReactNode; right: ReactNode };
  /** Drop the drop-shadow (flat in the bar). */
  flat?: boolean;
}

export function Orb({
  size,
  state,
  style,
  params,
  pulse,
  leftOn = true,
  rightOn = true,
  mic,
  onToggleLeft,
  onToggleRight,
  idleIcons,
  overlayIcons,
  flat,
}: OrbProps) {
  const orbRef = useRef<HTMLDivElement>(null);
  const leftHalfRef = useRef<HTMLDivElement>(null);
  const rightHalfRef = useRef<HTMLDivElement>(null);
  const leftCv = useRef<HTMLCanvasElement>(null);
  const rightCv = useRef<HTMLCanvasElement>(null);
  const fullCv = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  const cfg = useRef<OrbCfg>({ state, style, params, pulse, leftOn, rightOn });
  cfg.current = { state, style, params, pulse, leftOn, rightOn };
  const localMic = useRef<OrbMic>({ on: false, amp: 0 });
  const micRef = mic ?? localMic;

  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;
    const shell = shellRef.current;
    const noise = makeNoise(701);
    const blobs = makeBlobs();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let last = 0;
    let tL = 0;
    let tR = 0;
    let tF = 0;
    let irisAng = 0;

    const setVar = (name: string, v: string) => orb.style.setProperty(name, v);

    const drawHalf = (cv: HTMLCanvasElement | null, side: 'left' | 'right', dt: number): void => {
      if (!cv) return;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      const d = cv.clientWidth;
      const h = cv.clientHeight;
      if (!d) return;
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
      const m = micRef.current;
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
      const time = side === 'left' ? (tL += dt * sp) : (tR += dt * sp);
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
        const radv =
          R *
          b.sz *
          (0.9 + 0.14 * noise(b.seed * 3, bt * 0.4)) *
          (0.5 + 0.9 * glow) *
          (0.7 + spread);
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
      const m = micRef.current;
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
        const radv =
          R *
          b.sz *
          (0.9 + 0.14 * noise(b.seed * 3, bt * 0.4)) *
          (0.5 + 0.9 * glow) *
          (0.7 + spread);
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
      const m = micRef.current;
      const talking = c.state !== 'idle';
      const full = talking && c.style === 'full';
      const aset = talking ? c.params.talk : c.params.idle;
      setVar('--glass', String(aset.glass / 100));
      setVar('--rim', String(aset.rim / 100));
      setVar('--body', String(aset.body / 100));
      setVar('--hi', String(aset.hi / 100));
      setVar('--blur', `${((aset.blur / 100) * 6).toFixed(1)}px`);
      setVar('--iris', String((aset.iris ?? 0) / 100));
      setVar('--depth', String((aset.depth ?? 0) / 100));
      irisAng = (irisAng + dt * 22) % 360;
      setVar('--irisang', `${irisAng.toFixed(1)}deg`);
      orb.classList.toggle('ot-full', full);
      const t2 = performance.now() / 1000;
      const pz = c.pulse;
      const prate = 1 + (pz.speed / 100) * 3;
      const pbase = pz.size / 100;
      const pamt = pz.amt / 100;
      // orbAmt scales the whole DISC expansion. 0 keeps the disc perfectly stable
      // while the membrane and inner light still move on their own.
      const oa = (pz.orbAmt ?? 100) / 100;
      if (full) {
        const micF = m.on ? 0.5 + m.amp * 0.9 : 1;
        const swing = (0.5 + 0.5 * Math.sin(t2 * prate * 2)) * pamt * 0.22;
        const grow = 1 + (pbase + swing) * micF * oa;
        orb.style.transform = `scale(${grow.toFixed(3)})`;
      } else {
        orb.style.transform = '';
      }
      const activeSide = c.state === 'coach' ? 'left' : c.state === 'user' ? 'right' : null;
      if (talking && c.style === 'directional' && activeSide) {
        const micF = m.on ? 0.5 + m.amp * 0.9 : 1;
        const swing = (0.5 + 0.5 * Math.sin(t2 * prate * 2)) * pamt * 0.2;
        const gv = 1 + (pbase * 0.85 + swing) * micF * oa;
        if (leftHalfRef.current)
          leftHalfRef.current.style.transform =
            activeSide === 'left' ? `scale(${gv.toFixed(3)})` : '';
        if (rightHalfRef.current)
          rightHalfRef.current.style.transform =
            activeSide === 'right' ? `scale(${gv.toFixed(3)})` : '';
      } else {
        if (leftHalfRef.current) leftHalfRef.current.style.transform = '';
        if (rightHalfRef.current) rightHalfRef.current.style.transform = '';
      }
      // Organic outer membrane (matches the standalone HTML orb builder): morphing
      // blobs that live outside the disc, breathing with the pulse and the mic.
      // Driven by the aura param; 0 keeps it fully hidden so existing looks are
      // unchanged. The morph itself is a CSS keyframe; JS drives size + color.
      if (shell && !flat) {
        const auraP = (aset.aura ?? 0) / 100;
        const memAmt = (pz.mem ?? 60) / 100;
        const mrate = 0.5 + ((pz.memSpeed ?? 35) / 100) * 2.2;
        const micA = m.on ? 0.7 + m.amp * 0.8 : 1;
        const memSwing = (0.5 + 0.5 * Math.sin(t2 * mrate)) * (0.05 + 0.26 * memAmt);
        shell.style.setProperty('--mem', auraP.toFixed(3));
        shell.style.setProperty('--memscale', (1 + auraP * memSwing * micA).toFixed(3));
        shell.style.setProperty(
          '--memc',
          c.state === 'coach'
            ? 'rgba(70,140,255,0.60)'
            : c.state === 'user'
              ? 'rgba(250,190,60,0.60)'
              : 'rgba(150,175,255,0.55)',
        );
      }
      drawHalf(leftCv.current, 'left', dt);
      drawHalf(rightCv.current, 'right', dt);
      drawFull(fullCv.current, dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [micRef]);

  const showLeftIcon = overlayIcons
    ? overlayIcons.left
    : idleIcons && state === 'idle' && !leftOn
      ? idleIcons.left
      : null;
  const showRightIcon = overlayIcons
    ? overlayIcons.right
    : idleIcons && state === 'idle' && !rightOn
      ? idleIcons.right
      : null;

  return (
    <div
      ref={shellRef}
      className={`ot-shell${flat ? 'ot-flat' : ''}`}
      style={{ ['--D' as string]: `${size}px` } as React.CSSProperties}
    >
      <div className="ot-membrane" aria-hidden="true">
        <div className="ot-mem ot-mem1" />
        <div className="ot-mem ot-mem2" />
      </div>
      <div ref={orbRef} className="ot-orb">
        <div ref={leftHalfRef} className="ot-half ot-left" onClick={onToggleLeft}>
          <canvas ref={leftCv} className="ot-cv" />
          <div className="ot-glass" />
          <div className="ot-spec" />
          <div className="ot-ico">{showLeftIcon}</div>
        </div>
        <div ref={rightHalfRef} className="ot-half ot-right" onClick={onToggleRight}>
          <canvas ref={rightCv} className="ot-cv" />
          <div className="ot-glass" />
          <div className="ot-spec" />
          <div className="ot-ico">{showRightIcon}</div>
        </div>
        <div className="ot-full-wrap">
          <div className="ot-fullbody" />
          <canvas ref={fullCv} className="ot-cv" />
          <div className="ot-fullglass" />
          <div className="ot-spec" />
        </div>
        <div className="ot-depth" />
        <div className="ot-ring" />
        <div className="ot-iris" />
      </div>
      <style>{ORB_CSS}</style>
    </div>
  );
}

const ORB_CSS = `
.ot-shell{position:relative;display:inline-block;width:var(--D);height:var(--D)}
.ot-membrane{position:absolute;left:50%;top:50%;width:calc(var(--D) * 1.42);height:calc(var(--D) * 1.42);transform:translate(-50%,-50%) scale(var(--memscale,1));opacity:var(--mem,0);pointer-events:none;z-index:0}
.ot-shell.ot-flat .ot-membrane{display:none}
.ot-mem{position:absolute;left:50%;top:50%;width:100%;height:100%;transform:translate(-50%,-50%);pointer-events:none;mix-blend-mode:screen;filter:blur(calc(var(--D) * 0.05));background:radial-gradient(circle at 42% 38%, var(--memc, rgba(150,175,255,.55)) 0%, transparent 66%);border-radius:46% 54% 52% 48% / 52% 46% 54% 48%;animation:ot-wob 7s ease-in-out infinite}
.ot-mem2{width:80%;height:80%;opacity:.82;filter:blur(calc(var(--D) * 0.035));animation:ot-wob2 5.2s ease-in-out infinite}
@keyframes ot-wob{0%,100%{border-radius:46% 54% 52% 48% / 52% 46% 54% 48%;rotate:0deg}50%{border-radius:54% 46% 48% 52% / 46% 54% 47% 53%;rotate:8deg}}
@keyframes ot-wob2{0%,100%{border-radius:52% 48% 46% 54% / 48% 52% 50% 50%;rotate:0deg}50%{border-radius:47% 53% 55% 45% / 53% 47% 52% 48%;rotate:-9deg}}
.ot-orb{position:relative;z-index:1;width:var(--D);height:var(--D);border-radius:50%;overflow:hidden;--gap:max(5px, calc(var(--D)*0.06));--innerR:calc(var(--D)*0.0494);box-shadow:0 8px 22px rgba(20,30,60,.26), 0 0 24px 2px rgba(175,195,255,.16)}
.ot-shell.ot-flat .ot-orb{box-shadow:none}
.ot-orb.ot-full{--gap:0px;--innerR:0px}
.ot-half{position:absolute;top:0;height:100%;width:calc(50% - var(--gap)/2);overflow:hidden;background:radial-gradient(125% 125% at 50% 34%, rgba(255,255,255, calc(0.20 + 0.16*(1 - var(--body)))), rgba(255,255,255, calc(0.04 + 0.05*(1 - var(--body)))) 52%, rgba(8,11,22, calc(0.10 + 0.52*var(--body))) 100%)}
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
.ot-depth{position:absolute;inset:0;border-radius:50%;pointer-events:none;z-index:5;opacity:var(--depth,0);box-shadow:inset 0 calc(var(--D) * -0.11) calc(var(--D) * 0.15) rgba(6,12,28,.55), inset 0 calc(var(--D) * 0.05) calc(var(--D) * 0.09) rgba(255,255,255,.55)}
.ot-iris{position:absolute;inset:0;border-radius:50%;pointer-events:none;z-index:7;opacity:var(--iris,0);background:conic-gradient(from var(--irisang,0deg), #8ec5ff, #c9b8ff, #ffd1e8, #fff2b0, #b8ffe0, #8ec5ff);-webkit-mask:radial-gradient(closest-side, transparent 76%, #000 87%, #000 96%, transparent 100%);mask:radial-gradient(closest-side, transparent 76%, #000 87%, #000 96%, transparent 100%);mix-blend-mode:screen}
`;
