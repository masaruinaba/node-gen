'use client';

import { useRef, useEffect } from 'react';
import { PAD_CONFIG } from '@/lib/padConfig';
import { PALETTES, DEFAULT_SIGNAL_CONFIG, type GridMode, type RenderState } from '@/lib/nodeTypes';

export const GRID_ROWS = 11;
export const GRID_COLS = 11;

const DOT_BASE_R = 1.4;

interface Props {
  knobX: number;
  knobY: number;
  isDragging: boolean;
  borderRadius: number;
  energy?: number;
  bgLuminance?: number;
  zoom?: number;
  paletteId?: string;
  gridMode?: GridMode;
  signalLevel?: number;
  hueOffset?: number;
  /** グラフ評価から注入される描画状態（提供時は paletteId/signalLevel/hueOffset を上書き） */
  renderState?: RenderState;
}

function hslToStr(h: number, s: number, l: number, a: number): string {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

export default function DotGrid({
  knobX, knobY, isDragging, borderRadius,
  energy = 0, zoom = 1,
  paletteId = 'warm', gridMode = 'ripple', signalLevel = 0, hueOffset = 0,
  renderState,
}: Props) {
  // renderState が提供された場合、描画パラメータを上書き
  const rs = renderState;
  const effectivePaletteId  = rs ? undefined : paletteId;
  const effectiveSignalLevel = rs ? rs.energy + rs.pulse * 0.3 : signalLevel;
  const effectiveHueOffset   = rs ? rs.hueShift : hueOffset;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.parentElement!.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cfg = DEFAULT_SIGNAL_CONFIG;
    const { sigma, baseStrength, dragBoost, energyBoost } = PAD_CONFIG.magnetic;
    const { normalAlpha, axisAlpha, intersectionAlpha } = PAD_CONFIG.cross;
    // renderState.palette があれば直接使用、なければ paletteId から取得
    const palette = (rs?.palette) || PALETTES[effectivePaletteId ?? 'warm'] || PALETTES.warm;

    const magneticMax = baseStrength + (isDragging ? dragBoost : 0) + energy * energyBoost;

    const pad = 14;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;

    const gx = (knobX + 1) / 2;
    const gy = (knobY + 1) / 2;
    const activeCol = Math.round(gx * (GRID_COLS - 1));
    const activeRow = Math.round(gy * (GRID_ROWS - 1));

    timeRef.current += 1;
    const time = timeRef.current;

    ctx.clearRect(0, 0, w, h);

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const fx = c / (GRID_COLS - 1);
        const fy = r / (GRID_ROWS - 1);
        const px = pad + fx * innerW;
        const py = pad + fy * innerH;

        const dx = fx - gx;
        const dy = fy - gy;
        const d = Math.sqrt(dx * dx + dy * dy);

        const influence = Math.exp(-(d * d) / (2 * sigma * sigma));

        // Signal value per mode
        const sl = effectiveSignalLevel;
        let signal = 0;
        if (gridMode === 'ripple') {
          const wave = Math.sin((d * 12 - time * cfg.propagationSpeed) * Math.PI * 2);
          signal = (wave * 0.5 + 0.5) * sl;
        } else if (gridMode === 'pulse') {
          signal = sl > cfg.pulseThreshold
            ? Math.max(0, 1 - d * 3) * sl
            : 0;
        } else {
          const breath = Math.sin(time * 0.02 * (Math.PI * 2 / (cfg.breatheCycle / 60))) * 0.5 + 0.5;
          signal = breath * sl * (1 - d * 0.5);
        }
        signal = Math.max(0, Math.min(1, signal));

        // Color from palette + signal
        const palIdx = signal * (palette.length - 1);
        const palLo = Math.floor(palIdx);
        const palHi = Math.min(palette.length - 1, palLo + 1);
        const palT = palIdx - palLo;
        const colH = ((palette[palLo][0] * (1 - palT) + palette[palHi][0] * palT) + effectiveHueOffset) % 360;
        const colS = palette[palLo][1] * (1 - palT) + palette[palHi][1] * palT;
        const colL = palette[palLo][2] * (1 - palT) + palette[palHi][2] * palT;

        // Opacity: base + magnetic influence + signal
        const baseAlpha = cfg.opacityRange[0];
        const maxAlpha = cfg.opacityRange[1];
        let alpha = baseAlpha + influence * magneticMax * 0.3 + signal * (maxAlpha - baseAlpha) * 0.7;
        alpha = Math.min(maxAlpha, Math.max(baseAlpha, alpha));

        // XY cross: axis/intersection dots get stronger alpha only when dragging
        const onCol = c === activeCol;
        const onRow = r === activeRow;
        if (isDragging) {
          if (onCol || onRow) alpha = Math.max(alpha, axisAlpha);
          if (onCol && onRow) alpha = Math.max(alpha, intersectionAlpha);
        }

        // Scale: subtle magnetic + signal
        const scaleMin = cfg.scaleRange[0];
        const scaleMax = cfg.scaleRange[1];
        const dotScale = scaleMin + influence * magneticMax * 0.4 + signal * (scaleMax - scaleMin) * 0.5;
        const dotR = DOT_BASE_R * dotScale;

        // Mix: colorMix from renderState amplifies palette saturation (stronger base color)
        const colorMix = Math.min(1, signal * 2.2 + 0.2 + (rs?.colorMix ?? 0) * 0.4);
        const finalH = colH;
        const finalS = Math.min(100, colS * colorMix * 1.15);
        const finalL = 100 - (100 - colL) * colorMix;

        ctx.beginPath();
        ctx.arc(px, py, dotR, 0, Math.PI * 2);
        ctx.fillStyle = hslToStr(finalH, finalS, finalL, alpha);
        ctx.fill();
      }
    }
  }, [knobX, knobY, isDragging, energy, zoom, paletteId, gridMode, signalLevel, hueOffset, renderState, effectiveSignalLevel, effectiveHueOffset, effectivePaletteId, rs]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ borderRadius }}
    />
  );
}
