import { useEffect, useRef } from 'react';

// The locked speaking visual (#4 "thick, easy flare"): a soft-body voice horn
// that leaves the orb's left lip already thick, flares forward (left), and
// dissolves at the end. Amplitude and opacity ride the live voice level, so it
// swells while the coach speaks and fades to nothing in the pauses.
const BLUE = '19,91,235';
const CFG = {
  nLines: 5,
  startW: 20,
  endW: 56,
  expandPow: 0.72,
  fillOp: 0.16,
  lineBase: 0.55,
  kBase: 0.12,
  wBase: 1.95,
  curl: 14,
  fadeStart: 0.5,
  fadeEnd: 1.04,
  fadePow: 1.5,
};

function sm(a: number, b: number, x: number): number {
  let t = (x - a) / (b - a);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}

interface VoiceConeProps {
  /** True while the coach is speaking. */
  active: boolean;
  /** 0..1 live voice amplitude, drives the horn's size and brightness. */
  intensity: number;
  /** Orb radius in px; the horn emits from the orb's left edge (centerX - radius). */
  orbRadius?: number;
  /** Vertical center of the orb as a fraction of height (matches the orb's speaking pose). */
  originYRatio?: number;
}

export function VoiceCone({
  active,
  intensity,
  orbRadius = 75,
  originYRatio = 0.5,
}: VoiceConeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intRef = useRef(0);
  const activeRef = useRef(false);

  useEffect(() => {
    intRef.current = intensity;
  }, [intensity]);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !parent || !ctx) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = 0;
    let H = 0;
    let gSmooth = 0;
    let raf = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const r = parent.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    const draw = (t: number) => {
      // Only emit on real speech: no always-on floor, just the live amplitude.
      const lvl = intRef.current;
      const targetG = activeRef.current && lvl > 0.04 ? Math.min(1, lvl * 1.15) : 0;
      gSmooth += (targetG - gSmooth) * 0.16;
      ctx.clearRect(0, 0, W, H);
      const g = gSmooth;

      if (g > 0.02 && !prefersReduced && W > 0) {
        const px = W / 2 - orbRadius;
        const cy = H * originYRatio;
        const len = Math.max(40, px - 6);
        const endX = px - len;
        const ampScale = 0.5 + 0.7 * g;

        const coneAmp = (p: number) =>
          sm(0, 0.03, p) *
          (CFG.startW + (CFG.endW - CFG.startW) * Math.pow(p, CFG.expandPow)) *
          ampScale;
        const opMul = (p: number) => 1 - Math.pow(sm(CFG.fadeStart, CFG.fadeEnd, p), CFG.fadePow);
        const ycAt = (x: number) => {
          const p = (px - x) / len;
          return cy - CFG.curl * p * p;
        };
        const gradFor = (baseOp: number) => {
          const grad = ctx.createLinearGradient(px, 0, endX, 0);
          for (let s = 0; s <= 6; s++) {
            const pp = s / 6;
            grad.addColorStop(pp, `rgba(${BLUE},${(baseOp * g * opMul(pp)).toFixed(3)})`);
          }
          return grad;
        };

        // Faint cone body
        const phE = t * 0.001 * CFG.wBase;
        ctx.beginPath();
        let f = true;
        for (let x = px; x >= endX; x -= 3) {
          const y = ycAt(x) + coneAmp((px - x) / len) * Math.sin(CFG.kBase * x + phE);
          if (f) {
            ctx.moveTo(x, y);
            f = false;
          } else ctx.lineTo(x, y);
        }
        for (let x2 = endX; x2 <= px; x2 += 3) {
          const yb = ycAt(x2) - coneAmp((px - x2) / len) * Math.sin(CFG.kBase * x2 + phE);
          ctx.lineTo(x2, yb);
        }
        ctx.closePath();
        ctx.fillStyle = gradFor(CFG.fillOp);
        ctx.fill();

        // Woven wave lines, small to large
        for (let i = 0; i < CFG.nLines; i++) {
          const level = (i + 1) / CFG.nLines;
          const ki = CFG.kBase * (0.82 + 0.5 * (i / CFG.nLines));
          const wi = CFG.wBase * (0.88 + 0.55 * (i / CFG.nLines));
          const ph = i * 1.15;
          const lineOp = CFG.lineBase * (0.5 + 0.5 * level);
          ctx.beginPath();
          let ff = true;
          for (let x3 = px; x3 >= endX; x3 -= 2) {
            const amp = coneAmp((px - x3) / len) * level;
            const y3 = ycAt(x3) + amp * Math.sin(ki * x3 + t * 0.001 * wi + ph);
            if (ff) {
              ctx.moveTo(x3, y3);
              ff = false;
            } else ctx.lineTo(x3, y3);
          }
          ctx.lineWidth = 2.4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = gradFor(lineOp);
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [orbRadius, originYRatio]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}
