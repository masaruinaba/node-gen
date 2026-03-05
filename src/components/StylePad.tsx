'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import DotGrid from './DotGrid';
import { PAD_CONFIG } from '@/lib/padConfig';
import type { GridMode, RenderState } from '@/lib/nodeTypes';

const CARD_RADIUS = 28;
const KNOB_RATIO = 0.14;
const KNOB_MIN = 10;
const KNOB_MAX = 24;
const KNOB_HIT_RATIO = 2.5;  // hit area = knob size * this
const KNOB_SCALE_DRAG = 1.06;
const KNOB_SHADOW = '0 1px 8px rgba(0,0,0,.18)';
const LERP_KNOB = 0.18;
const DEFAULT_SIZE = 130;

interface Props {
  x: number;
  y: number;
  onMove: (x: number, y: number) => void;
  labels?: { left: string; right: string; top: string; bottom: string };
  size?: number;
  hueOffset?: number;
  zoom?: number;
  paletteId?: string;
  gridMode?: GridMode;
  signalLevel?: number;
  onGrab?: () => void;
  onRelease?: () => void;
  onEdge?: () => void;
  renderState?: RenderState;
}

const lp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function StylePad({ x, y, onMove, labels, size, hueOffset = 0, zoom = 1, paletteId, gridMode, signalLevel = 0, onGrab, onRelease, onEdge, renderState }: Props) {
  const padRef = useRef<HTMLDivElement>(null);

  const dragging = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  /* ── refs for animation state (avoid re-renders) ── */
  const target = useRef({ x, y });
  const knobR = useRef({ x, y });
  const gradR = useRef({ x, y });
  const energyR = useRef(0);
  const raf = useRef(0);

  /* ── render state: one object, one setState ── */
  const [v, setV] = useState({
    kx: x, ky: y,        // knob (lerped)
    gx: x, gy: y,        // gradient center (slow lerp)
    energy: 0,
  });

  /* ─────────────────── animation loop ─────────────────── */
  const animate = useCallback(() => {
    cancelAnimationFrame(raf.current);

    const tick = () => {
      const t = target.current;
      const prevKx = knobR.current.x;
      const prevKy = knobR.current.y;

      const kx = lp(prevKx, t.x, LERP_KNOB);
      const ky = lp(prevKy, t.y, LERP_KNOB);
      const gx = lp(gradR.current.x, t.x, PAD_CONFIG.bg.followLerp);
      const gy = lp(gradR.current.y, t.y, PAD_CONFIG.bg.followLerp);

      const speed = Math.sqrt((kx - prevKx) ** 2 + (ky - prevKy) ** 2);
      const cfg = PAD_CONFIG.energy;
      const rawEnergy = Math.min(1, speed * cfg.speedMultiplier);
      const floor = dragging.current ? cfg.dragFloor : 0;
      energyR.current = Math.max(floor, lp(energyR.current, rawEnergy, cfg.lerpSpeed));

      knobR.current = { x: kx, y: ky };
      gradR.current = { x: gx, y: gy };
      setV({ kx, ky, gx, gy, energy: energyR.current });

      const settled =
        Math.abs(t.x - kx) < 0.0005 &&
        Math.abs(t.y - ky) < 0.0005 &&
        Math.abs(t.x - gx) < 0.001 &&
        Math.abs(t.y - gy) < 0.001 &&
        energyR.current < 0.002;

      if (dragging.current || !settled) {
        raf.current = requestAnimationFrame(tick);
      }
    };
    raf.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!dragging.current) {
      const sz = size ?? DEFAULT_SIZE;
      const kr = Math.max(KNOB_MIN, Math.min(KNOB_MAX, sz * KNOB_RATIO)) / 2;
      const m = kr / sz;
      const lo = 2 * m - 1;
      const hi = 1 - 2 * m;
      target.current = {
        x: Math.max(lo, Math.min(hi, x)),
        y: Math.max(lo, Math.min(hi, y)),
      };
      animate();
    }
  }, [x, y, animate, size]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  /* ─────────────────── pointer → normalised coords ─────────────────── */
  const wasEdge = useRef(false);

  const calcXY = useCallback((cx: number, cy: number) => {
    if (!padRef.current) return null;
    const r = padRef.current.getBoundingClientRect();
    const rawX = ((cx - r.left) / r.width) * 2 - 1;
    const rawY = ((cy - r.top) / r.height) * 2 - 1;
    const resolvedSz = size ?? DEFAULT_SIZE;
    const knobRadius = Math.max(KNOB_MIN, Math.min(KNOB_MAX, resolvedSz * KNOB_RATIO)) / 2;
    const margin = knobRadius / resolvedSz;
    const normMin = 2 * margin - 1;
    const normMax = 1 - 2 * margin;
    return {
      x: Math.max(normMin, Math.min(normMax, rawX)),
      y: Math.max(normMin, Math.min(normMax, rawY)),
      atEdge: rawX < -1.01 || rawX > 1.01 || rawY < -1.01 || rawY > 1.01,
    };
  }, [size]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!padRef.current) return;
    const r = padRef.current.getBoundingClientRect();
    const resolvedSz = size ?? DEFAULT_SIZE;
    const knobSz = Math.max(KNOB_MIN, Math.min(KNOB_MAX, resolvedSz * KNOB_RATIO));
    const marginPct = (knobSz / 2 / resolvedSz) * 100;
    const clampPct = (p: number) => Math.max(marginPct, Math.min(100 - marginPct, p));
    const curKnobPx = r.left + (clampPct(((knobR.current.x + 1) / 2) * 100) / 100) * r.width;
    const curKnobPy = r.top + (clampPct(((knobR.current.y + 1) / 2) * 100) / 100) * r.height;
    const dx = e.clientX - curKnobPx;
    const dy = e.clientY - curKnobPy;
    const hitR = knobSz * KNOB_HIT_RATIO / 2;
    if (dx * dx + dy * dy > hitR * hitR) return; // let card drag handle it

    e.stopPropagation();
    dragging.current = true;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = calcXY(e.clientX, e.clientY);
    if (p) {
      target.current = p;
      onMove(p.x, p.y);
      animate();
      onGrab?.();
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const p = calcXY(e.clientX, e.clientY);
    if (p) {
      target.current = p;
      onMove(p.x, p.y);
      if (p.atEdge && !wasEdge.current) onEdge?.();
      wasEdge.current = p.atEdge;
    }
  };

  const onPointerUp = () => {
    dragging.current = false;
    setIsDragging(false);
    wasEdge.current = false;
    onRelease?.();
  };

  useEffect(() => {
    const prevent = (e: TouchEvent) => {
      if (dragging.current) e.preventDefault();
    };
    window.addEventListener('touchmove', prevent, { passive: false });
    return () => window.removeEventListener('touchmove', prevent);
  }, []);

  /* ─────────────────── background gradient (XY-driven) ─────────────────── */
  const bgCfg = PAD_CONFIG.bg;
  const e = v.energy;

  // x: -1 → warm, +1 → cool
  const xNorm = (v.gx + 1) / 2; // 0..1
  const hue = ((lp(bgCfg.warmHue, bgCfg.coolHue, xNorm) + hueOffset) % 360 + 360) % 360;
  const sat = bgCfg.baseSat + v.gx * bgCfg.xSatShift + e * bgCfg.energySatBoost;
  const light = bgCfg.baseLightness - v.gy * bgCfg.yLightnessShift + e * bgCfg.energyLightBoost;

  // gradient center follows XY
  const gcx = 30 + xNorm * 40;               // 30%..70%
  const gcy = 30 + ((v.gy + 1) / 2) * 40;    // 30%..70%

  const cardBg = `radial-gradient(ellipse at ${gcx}% ${gcy}%, hsl(${hue} ${sat}% ${Math.min(light + 14, 80)}%) 0%, hsl(${hue} ${sat}% ${light}%) 60%, hsl(${hue} ${Math.max(sat - 10, 10)}% ${Math.max(light - 16, 20)}%) 100%)`;

  const bgLuminance = light / 100;

  /* ─────────────────── knob position (clamped so it stays inside card) ─────────────────── */
  const resolvedSize = size ?? DEFAULT_SIZE;
  const knobSize = Math.max(KNOB_MIN, Math.min(KNOB_MAX, resolvedSize * KNOB_RATIO));
  const marginPct = (knobSize / 2 / resolvedSize) * 100;
  const clampPct = (p: number) => Math.max(marginPct, Math.min(100 - marginPct, p));
  const knobLeft = clampPct(((v.kx + 1) / 2) * 100);
  const knobTop = clampPct(((v.ky + 1) / 2) * 100);
  const knobScale = isDragging ? KNOB_SCALE_DRAG : 1;

  const padWidth = size ? `${size}px` : 'min(76vw, 320px)';

  const innerPad = (
    <div
      ref={padRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="relative aspect-square cursor-grab active:cursor-grabbing touch-none"
      style={{
        width: padWidth,
        borderRadius: CARD_RADIUS,
        background: cardBg,
        boxShadow: '0 8px 40px rgba(0,0,0,.25), inset 0 0 0 1px rgba(255,255,255,.04)',
        transition: 'background .08s ease-out',
      }}
    >
      <DotGrid
        knobX={v.kx}
        knobY={v.ky}
        isDragging={isDragging}
        borderRadius={CARD_RADIUS}
        energy={v.energy}
        bgLuminance={bgLuminance}
        zoom={zoom}
        paletteId={paletteId}
        gridMode={gridMode}
        signalLevel={signalLevel}
        hueOffset={hueOffset}
        renderState={renderState}
      />

      {/* knob */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${knobLeft}%`,
          top: `${knobTop}%`,
          width: knobSize,
          height: knobSize,
          borderRadius: '50%',
          background: '#fff',
          transform: `translate(-50%,-50%) scale(${knobScale})`,
          boxShadow: KNOB_SHADOW,
          transition: 'transform .2s cubic-bezier(.22,1,.36,1)',
        }}
      />
    </div>
  );

  if (!labels) {
    return <div className="select-none">{innerPad}</div>;
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full select-none">
      <span className="text-[10px] font-medium tracking-[0.2em] text-white/35 uppercase">
        {labels.top}
      </span>

      <div className="flex items-center w-full justify-center" style={{ gap: 14 }}>
        <span
          className="text-[10px] font-medium tracking-[0.2em] text-white/35 uppercase shrink-0"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
        >
          {labels.left}
        </span>

        {innerPad}

        <span
          className="text-[10px] font-medium tracking-[0.2em] text-white/35 uppercase shrink-0"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          {labels.right}
        </span>
      </div>

      <span className="text-[10px] font-medium tracking-[0.2em] text-white/35 uppercase">
        {labels.bottom}
      </span>
    </div>
  );
}
