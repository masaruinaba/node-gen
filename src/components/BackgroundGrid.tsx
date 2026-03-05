'use client';

import { useRef, useEffect } from 'react';

const WORLD_SPACING = 30;
const MAX_DISP = 30;
const DOT_R = 1.0;
const DOT_BASE_ALPHA = 0.10;
const DOT_BRIGHT_ALPHA = 0.35;
const BRIGHT_SIGMA_MULT = 2.0;
const LINE_ALPHA = 0.08;

interface PadInfo {
  centerX: number; // screen px
  centerY: number;
  radius: number;  // screen px (PAD_SIZE/2 * scale)
}

interface Transform { x: number; y: number; scale: number }

interface Props {
  pads: PadInfo[];
  transform: Transform;
}

function draw(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number,
  pads: PadInfo[],
  tr: Transform,
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const spacing = WORLD_SPACING * tr.scale;
  const offX = ((tr.x % spacing) + spacing) % spacing;
  const offY = ((tr.y % spacing) + spacing) % spacing;

  // Include extra columns/rows for off-screen buffers
  const cols = Math.ceil((w - offX) / spacing) + 3;
  const rows = Math.ceil((h - offY) / spacing) + 3;

  // Build displaced grid
  const pts: { x: number; y: number }[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: { x: number; y: number }[] = [];
    for (let c = 0; c < cols; c++) {
      const baseX = offX + (c - 1) * spacing;
      const baseY = offY + (r - 1) * spacing;

      let dispX = 0, dispY = 0;
      for (const pad of pads) {
        const dx = baseX - pad.centerX;
        const dy = baseY - pad.centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.5) continue;
        const sigma = pad.radius * 1.4;
        const mag = MAX_DISP * Math.exp(-dist * dist / (2 * sigma * sigma));
        dispX += (dx / dist) * mag;
        dispY += (dy / dist) * mag;
      }

      row.push({ x: baseX + dispX, y: baseY + dispY });
    }
    pts.push(row);
  }

  // Draw grid lines (horizontal segments between adjacent displaced points)
  ctx.strokeStyle = `rgba(255,255,255,${LINE_ALPHA})`;
  ctx.lineWidth = 0.5;

  ctx.beginPath();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      ctx.moveTo(pts[r][c].x, pts[r][c].y);
      ctx.lineTo(pts[r][c + 1].x, pts[r][c + 1].y);
    }
  }
  ctx.stroke();

  // Vertical segments
  ctx.beginPath();
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.moveTo(pts[r][c].x, pts[r][c].y);
      ctx.lineTo(pts[r + 1][c].x, pts[r + 1][c].y);
    }
  }
  ctx.stroke();

  // Dots at displaced positions — brighter near pads
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const { x, y } = pts[r][c];
      if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue;

      let brightness = 0;
      for (const pad of pads) {
        const pdx = x - pad.centerX;
        const pdy = y - pad.centerY;
        const dist2 = pdx * pdx + pdy * pdy;
        const sig = pad.radius * BRIGHT_SIGMA_MULT;
        brightness = Math.max(brightness, Math.exp(-dist2 / (2 * sig * sig)));
      }

      const alpha = DOT_BASE_ALPHA + brightness * (DOT_BRIGHT_ALPHA - DOT_BASE_ALPHA);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, DOT_R, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export default function BackgroundGrid({ pads, transform }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const wRef = useRef(0);
  const hRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      wRef.current = w;
      hRef.current = h;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    draw(ctx, wRef.current, hRef.current, dpr, pads, transform);
  }, [pads, transform]);

  return (
    <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />
  );
}
