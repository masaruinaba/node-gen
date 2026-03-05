'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import StylePad from './StylePad';
import BackgroundGrid from './BackgroundGrid';
import { useAudioReactive, NUM_BANDS } from '@/hooks/useAudioReactive';
import { PALETTES } from '@/lib/nodeTypes';
import { useHaptics } from '@/hooks/useHaptics';

const PAD_SIZE = 130;
const HANDLE_H = 0;
const SILENCE = 0.025;
const INIT_RADIUS = 110;
const PAD_MIN_GAP = PAD_SIZE + 40; // 重ならないための最小中心間距離
const COLOR_MIN_MS = 8000;
const COLOR_MAX_MS = 18000;
const TAP_MAX_PX = 5; // ドラッグとタップを区別する閾値

const HUE_OFFSETS = [0, 130, 260, 50, 190, 310, 80, 220];
const PALETTE_CYCLE = ['warm', 'cool', 'neon', 'mono', 'earth', 'aurora', 'sunset', 'candy', 'ocean', 'lava'];

// ── Edges ──
function getEdges(count: number): [number, number][] {
  if (count <= 1) return [];
  const edges: [number, number][] = [];
  // Ring: each node connects to next
  for (let i = 0; i < count; i++) {
    edges.push([i, (i + 1) % count]);
  }
  return edges;
}

function organicPath(ax: number, ay: number, bx: number, by: number, seed: number, t: number): string {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return `M ${ax} ${ay} L ${bx} ${by}`;
  const nx = -dy / len;
  const ny = dx / len;

  const sway = len * 0.09;
  const w1 = Math.sin(t * 0.13 + seed * 2.3) * 0.5
            + Math.sin(t * 0.07 + seed * 5.1) * 0.3
            + Math.sin(t * 0.03 + seed * 8.7) * 0.2;
  const w2 = Math.sin(t * 0.11 + seed * 3.7 + 1.9) * 0.4
            + Math.cos(t * 0.05 + seed * 6.3) * 0.35
            + Math.sin(t * 0.02 + seed * 1.1 + 4.0) * 0.25;

  const c1x = ax + dx * 0.33 + nx * w1 * sway;
  const c1y = ay + dy * 0.33 + ny * w1 * sway;
  const c2x = ax + dx * 0.67 + nx * w2 * sway;
  const c2y = ay + dy * 0.67 + ny * w2 * sway;

  return `M ${ax} ${ay} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${bx} ${by}`;
}

// ── State types ──
interface PadState {
  id: string;
  cx: number;
  cy: number;
  x: number;
  y: number;
  hueOffset: number;
  paletteId: string;
  isManualDot: boolean;
  manualTimeoutId: ReturnType<typeof setTimeout> | null;
}

interface Transform { x: number; y: number; scale: number }

function getDotPos(pad: PadState) {
  return {
    x: pad.cx + PAD_SIZE * (pad.x + 1) / 2,
    y: pad.cy + HANDLE_H + PAD_SIZE * (pad.y + 1) / 2,
  };
}

// ── Audio → XY ──
interface CardProfile {
  xBands: number[];
  yBands: number[];
  xSign: number;
  ySign: number;
  speed: number;
  orbitR: number;
  delay: number;
}

const PROFILES: CardProfile[] = [
  { xBands: [0, 1],   yBands: [2, 3],   xSign:  1, ySign:  1, speed: 1.0, orbitR: 0.10, delay: 0 },
  { xBands: [4, 5],   yBands: [6, 7],   xSign: -1, ySign:  1, speed: 1.3, orbitR: 0.14, delay: 4 },
  { xBands: [8, 9],   yBands: [10, 11], xSign:  1, ySign: -1, speed: 0.7, orbitR: 0.18, delay: 8 },
  { xBands: [12, 13], yBands: [14, 15], xSign: -1, ySign: -1, speed: 1.6, orbitR: 0.12, delay: 12 },
  { xBands: [1, 6],   yBands: [3, 10],  xSign:  1, ySign: -1, speed: 0.9, orbitR: 0.16, delay: 3 },
  { xBands: [5, 11],  yBands: [7, 14],  xSign: -1, ySign:  1, speed: 1.1, orbitR: 0.11, delay: 7 },
  { xBands: [2, 9],   yBands: [0, 13],  xSign:  1, ySign:  1, speed: 1.4, orbitR: 0.13, delay: 5 },
  { xBands: [4, 15],  yBands: [8, 12],  xSign: -1, ySign: -1, speed: 0.8, orbitR: 0.17, delay: 10 },
];

const historyBuf: number[][] = [];

function bandToXY(i: number, bands: number[], tick: number): { x: number; y: number } {
  const overall = bands.reduce((s, b) => s + b, 0) / bands.length;
  if (overall < SILENCE) return { x: 0, y: 0 };
  historyBuf.push([...bands]);
  if (historyBuf.length > 20) historyBuf.shift();
  const p = PROFILES[i % PROFILES.length];
  const b = historyBuf[Math.max(0, historyBuf.length - 1 - p.delay)] || bands;
  const avgX = p.xBands.reduce((s, bi) => s + (b[bi] || 0), 0) / p.xBands.length;
  const avgY = p.yBands.reduce((s, bi) => s + (b[bi] || 0), 0) / p.yBands.length;
  const t = tick * 0.025 * p.speed;
  const orbitX = Math.sin(t) * p.orbitR * (0.5 + overall);
  const orbitY = Math.cos(t * 0.7 + i) * p.orbitR * (0.5 + overall);
  return {
    x: Math.max(-1, Math.min(1, p.xSign * (avgX * 2 - 1) + orbitX)),
    y: Math.max(-1, Math.min(1, p.ySign * (avgY * 2 - 1) + orbitY)),
  };
}

function makeInitialPads(W: number, H: number): PadState[] {
  const cx = W / 2;
  const cy = H / 2;
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as [number, number][]).map(([sx, sy], i) => ({
    id: `p${i}`,
    cx: cx + sx * INIT_RADIUS - PAD_SIZE / 2,
    cy: cy + sy * INIT_RADIUS - HANDLE_H - PAD_SIZE / 2,
    x: 0, y: 0,
    hueOffset: HUE_OFFSETS[i],
    paletteId: ['warm', 'cool', 'neon', 'earth'][i],
    isManualDot: false, manualTimeoutId: null,
  }));
}

type SourceTab = 'mic' | 'url';

export default function AudioCanvas() {
  const [pads, setPads] = useState<PadState[]>([]);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [sourceTab, setSourceTab] = useState<SourceTab>('mic');
  const [urlInput, setUrlInput] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState('');
  const [spaceDown, setSpaceDown] = useState(false);

  const { bands, isActive, connectMic, connectUrl, stop } = useAudioReactive();
  const haptic = useHaptics();
  const lastDragHapticRef = useRef(0);
  const tickRef = useRef(0);
  const threadSvgRef = useRef<SVGSVGElement>(null);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const cardDragRef = useRef<{ padId: string; startCx: number; startCy: number; startPx: number; startPy: number } | null>(null);
  const panRef = useRef<{ startTx: number; startTy: number; startPx: number; startPy: number } | null>(null);
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const padsRef = useRef(pads);
  padsRef.current = pads;
  const spaceDownRef = useRef(false);

  const overallLevel = useMemo(() => {
    if (!isActive) return 0;
    return bands.reduce((s, b) => s + b, 0) / bands.length;
  }, [bands, isActive]);

  useEffect(() => {
    setPads(makeInitialPads(window.innerWidth, window.innerHeight));
  }, []);

  // Animate connection lines via rAF (direct DOM, no React re-render)
  useEffect(() => {
    let raf = 0;
    const animate = () => {
      const svg = threadSvgRef.current;
      if (!svg) { raf = requestAnimationFrame(animate); return; }
      const t = performance.now() * 0.001;
      const groups = svg.querySelectorAll<SVGGElement>('g[data-edge]');
      groups.forEach(g => {
        const ai = Number(g.dataset.ai);
        const bi = Number(g.dataset.bi);
        const seed = Number(g.dataset.seed);
        const a = padsRef.current[ai];
        const b = padsRef.current[bi];
        if (!a || !b) return;
        const pa = getDotPos(a);
        const pb = getDotPos(b);
        const d = organicPath(pa.x, pa.y, pb.x, pb.y, seed, t);
        const paths = g.querySelectorAll('path');
        paths.forEach(p => p.setAttribute('d', d));
      });
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Auto color cycling
  useEffect(() => {
    let tid: ReturnType<typeof setTimeout>;
    const cycle = () => {
      setPads(prev => prev.map(p => ({
        ...p,
        hueOffset: (p.hueOffset + 8 + Math.random() * 12) % 360,
      })));
      tid = setTimeout(cycle, COLOR_MIN_MS + Math.random() * (COLOR_MAX_MS - COLOR_MIN_MS));
    };
    tid = setTimeout(cycle, COLOR_MIN_MS + Math.random() * (COLOR_MAX_MS - COLOR_MIN_MS));
    return () => clearTimeout(tid);
  }, []);

  // Audio → dot positions
  useEffect(() => {
    if (!isActive) return;
    tickRef.current += 1;
    const tick = tickRef.current;
    setPads(prev => prev.map((pad, i) => {
      if (pad.isManualDot) return pad;
      const t = bandToXY(i, bands, tick);
      return { ...pad, x: t.x, y: t.y };
    }));
  }, [bands, isActive]);

  // Keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); spaceDownRef.current = true; setSpaceDown(true); }
      if (e.code === 'Digit0' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setTransform({ x: 0, y: 0, scale: 1 }); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') { spaceDownRef.current = false; setSpaceDown(false); panRef.current = null; }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, []);

  // Pan
  useEffect(() => {
    const onPtrDown = (e: PointerEvent) => {
      if (!spaceDownRef.current) return;
      panRef.current = { startTx: transformRef.current.x, startTy: transformRef.current.y, startPx: e.clientX, startPy: e.clientY };
      haptic([20]);
    };
    const onPtrMove = (e: PointerEvent) => {
      if (!panRef.current) return;
      const { startTx, startTy, startPx, startPy } = panRef.current;
      setTransform(t => ({ ...t, x: startTx + e.clientX - startPx, y: startTy + e.clientY - startPy }));
      const now = Date.now();
      if (now - lastDragHapticRef.current > 150) {
        haptic([10]);
        lastDragHapticRef.current = now;
      }
    };
    const onPtrUp = () => { panRef.current = null; };
    window.addEventListener('pointerdown', onPtrDown);
    window.addEventListener('pointermove', onPtrMove);
    window.addEventListener('pointerup', onPtrUp);
    window.addEventListener('pointercancel', onPtrUp);
    return () => {
      window.removeEventListener('pointerdown', onPtrDown);
      window.removeEventListener('pointermove', onPtrMove);
      window.removeEventListener('pointerup', onPtrUp);
      window.removeEventListener('pointercancel', onPtrUp);
    };
  }, [haptic]);

  // Card drag + tap detection
  const handleCardPointerDown = useCallback((padId: string) => (e: React.PointerEvent) => {
    if (spaceDownRef.current) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const pad = padsRef.current.find(p => p.id === padId)!;
    cardDragRef.current = { padId, startCx: pad.cx, startCy: pad.cy, startPx: e.clientX, startPy: e.clientY };
    haptic('nudge');
  }, [haptic]);

  const handleCardPointerMove = useCallback((e: React.PointerEvent) => {
    if (!cardDragRef.current) return;
    const { padId, startCx, startCy, startPx, startPy } = cardDragRef.current;
    const scale = transformRef.current.scale;
    setPads(prev => prev.map(p => p.id === padId ? { ...p, cx: startCx + (e.clientX - startPx) / scale, cy: startCy + (e.clientY - startPy) / scale } : p));
    const now = Date.now();
    if (now - lastDragHapticRef.current > 120) {
      haptic([15]);
      lastDragHapticRef.current = now;
    }
  }, [haptic]);

  const handleCardPointerUp = useCallback((e: React.PointerEvent) => {
    if (!cardDragRef.current) return;
    const { padId, startPx, startPy } = cardDragRef.current;
    const dx = e.clientX - startPx;
    const dy = e.clientY - startPy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < TAP_MAX_PX) {
      // Tap: cycle palette
      haptic('success');
      setPads(prev => prev.map(p => {
        if (p.id !== padId) return p;
        const idx = PALETTE_CYCLE.indexOf(p.paletteId);
        const next = PALETTE_CYCLE[(idx + 1) % PALETTE_CYCLE.length];
        return { ...p, paletteId: next };
      }));
    } else {
      // Drop after drag
      haptic('nudge');
    }
    cardDragRef.current = null;
  }, [haptic]);

  // Dot override
  const handleDotGrab = useCallback((padId: string) => {
    setPads(prev => prev.map(p => {
      if (p.id !== padId) return p;
      if (p.manualTimeoutId) clearTimeout(p.manualTimeoutId);
      return { ...p, isManualDot: true, manualTimeoutId: null };
    }));
  }, []);

  const handleDotRelease = useCallback((padId: string) => {
    setPads(prev => prev.map(p => {
      if (p.id !== padId) return p;
      const tid = setTimeout(() => {
        setPads(cur => cur.map(cp => cp.id === padId ? { ...cp, isManualDot: false, manualTimeoutId: null } : cp));
      }, 2000);
      return { ...p, manualTimeoutId: tid };
    }));
  }, []);

  const handleDotMove = useCallback((padId: string, x: number, y: number) => {
    setPads(prev => prev.map(p => p.id === padId ? { ...p, x, y } : p));
  }, []);

  const handleReset = useCallback(() => {
    haptic('nudge');
    setPads(makeInitialPads(window.innerWidth, window.innerHeight));
    setTransform({ x: 0, y: 0, scale: 1 });
    tickRef.current = 0;
  }, [haptic]);

  const addPad = useCallback(() => {
    const all = padsRef.current;
    const centroidX = all.reduce((s, p) => s + p.cx + PAD_SIZE / 2, 0) / all.length;
    const centroidY = all.reduce((s, p) => s + p.cy + HANDLE_H + PAD_SIZE / 2, 0) / all.length;
    const palettes = Object.keys(PALETTES);

    // 重ならない位置を螺旋状に探す
    let cx = centroidX, cy = centroidY;
    const step = PAD_MIN_GAP;
    outer: for (let r = step; r < step * 30; r += step) {
      const numAngles = Math.max(6, Math.round(2 * Math.PI * r / step));
      for (let j = 0; j < numAngles; j++) {
        const angle = -Math.PI / 2 + (j * 2 * Math.PI) / numAngles;
        const tx = centroidX + Math.cos(angle) * r;
        const ty = centroidY + Math.sin(angle) * r;
        const overlaps = all.some(p => {
          const px = p.cx + PAD_SIZE / 2;
          const py = p.cy + HANDLE_H + PAD_SIZE / 2;
          return Math.hypot(tx - px, ty - py) < PAD_MIN_GAP;
        });
        if (!overlaps) { cx = tx; cy = ty; break outer; }
      }
    }

    haptic('success');
    setPads(prev => [...prev, {
      id: Math.random().toString(36).slice(2),
      cx: cx - PAD_SIZE / 2,
      cy: cy - HANDLE_H - PAD_SIZE / 2,
      x: 0, y: 0,
      hueOffset: HUE_OFFSETS[all.length % HUE_OFFSETS.length],
      paletteId: palettes[all.length % palettes.length],
      isManualDot: false, manualTimeoutId: null,
    }]);
  }, [haptic]);

  // Audio controls
  const handleMicConnect = useCallback(async () => {
    haptic('light');
    setError('');
    try { await connectMic(); } catch { setError('Mic access denied'); }
  }, [connectMic, haptic]);

  const handleUrlPlay = useCallback(() => {
    haptic('light');
    setError('');
    if (!urlInput.trim()) return;
    audioElRef.current = new Audio();
    audioElRef.current.crossOrigin = 'anonymous';
    audioElRef.current.src = urlInput.trim();
    audioElRef.current.loop = true;
    connectUrl(audioElRef.current);
    audioElRef.current.play().catch(() => { setError('Cannot play (CORS or invalid URL)'); stop(); });
    setIsPlaying(true);
  }, [urlInput, connectUrl, stop, haptic]);

  const handleUrlStop = useCallback(() => {
    haptic('light');
    audioElRef.current?.pause();
    audioElRef.current = null;
    stop();
    setIsPlaying(false);
  }, [stop, haptic]);

  const padCentersScreen = pads.map(p => ({
    centerX: (p.cx + PAD_SIZE / 2) * transform.scale + transform.x,
    centerY: (p.cy + HANDLE_H + PAD_SIZE / 2) * transform.scale + transform.y,
    radius: (PAD_SIZE / 2) * transform.scale,
  }));

  const edges = useMemo(() => getEdges(pads.length), [pads.length]);

  return (
    <div
      className="w-screen h-screen overflow-hidden bg-black select-none"
      style={{ position: 'relative', cursor: panRef.current ? 'grabbing' : spaceDown ? 'grab' : 'default' }}
    >
      <BackgroundGrid pads={padCentersScreen} transform={transform} />

      <div style={{
        position: 'absolute', transformOrigin: '0 0',
        transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`,
      }}>
        {/* Connection threads */}
        <svg ref={threadSvgRef} style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible', pointerEvents: 'none', zIndex: 10 }}>
          <defs>
            <filter id="thread-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
            </filter>
          </defs>
          {edges.map(([ai, bi]) => {
            const a = pads[ai];
            const b = pads[bi];
            if (!a || !b) return null;
            const pa = getDotPos(a);
            const pb = getDotPos(b);
            const seed = ai * 3.7 + bi * 1.3;
            const d = organicPath(pa.x, pa.y, pb.x, pb.y, seed, 0);
            return (
              <g key={`${a.id}-${b.id}`} data-edge="" data-ai={ai} data-bi={bi} data-seed={seed}>
                <path d={d} stroke="rgba(255,255,255,0.05)" strokeWidth="3.5" fill="none" filter="url(#thread-soft)" strokeLinecap="round" strokeLinejoin="round" />
                <path d={d} stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            );
          })}
        </svg>

        {/* Cards */}
        {pads.map(pad => (
          <div
            key={pad.id}
            style={{ position: 'absolute', left: pad.cx, top: pad.cy, zIndex: 20, cursor: 'grab' }}
            onPointerDown={handleCardPointerDown(pad.id)}
            onPointerMove={handleCardPointerMove}
            onPointerUp={handleCardPointerUp}
            onPointerCancel={handleCardPointerUp}
          >
            <StylePad
              x={pad.x} y={pad.y}
              size={PAD_SIZE}
              hueOffset={pad.hueOffset}
              paletteId={pad.paletteId}
              gridMode="ripple"
              signalLevel={overallLevel}
              onMove={(x, y) => handleDotMove(pad.id, x, y)}
              onGrab={() => handleDotGrab(pad.id)}
              onRelease={() => handleDotRelease(pad.id)}
            />
          </div>
        ))}
      </div>

      {/* Top UI */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2" style={{ zIndex: 40 }}>
        <div className="flex gap-1 rounded-full p-0.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {(['mic', 'url'] as SourceTab[]).map(tab => (
            <button key={tab} onClick={() => { haptic('light'); setSourceTab(tab); }}
              className="rounded-full px-4 py-1 text-[10px] tracking-[0.2em] uppercase transition-colors"
              style={{ background: sourceTab === tab ? 'rgba(255,255,255,0.12)' : 'transparent', color: sourceTab === tab ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)' }}>
              {tab}
            </button>
          ))}
        </div>
        {sourceTab === 'mic' && (!isActive
          ? <button onClick={handleMicConnect} className="px-5 py-1.5 rounded-full text-[10px] tracking-[0.2em] uppercase" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>connect mic</button>
          : <button onClick={() => { haptic('light'); stop(); }} className="px-5 py-1.5 rounded-full text-[10px] tracking-[0.2em] uppercase flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />stop
            </button>
        )}
        {sourceTab === 'url' && (
          <div className="flex gap-2 items-center">
            <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
              placeholder="https://example.com/audio.mp3"
              className="rounded-full px-4 py-1.5 text-[10px] outline-none"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', width: 220, border: '1px solid rgba(255,255,255,0.1)' }} />
            {!isPlaying
              ? <button onClick={handleUrlPlay} className="px-4 py-1.5 rounded-full text-[10px] tracking-[0.2em] uppercase" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>play</button>
              : <button onClick={handleUrlStop} className="px-4 py-1.5 rounded-full text-[10px] tracking-[0.2em] uppercase flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />stop
                </button>}
          </div>
        )}
        {error && <p className="text-[9px] text-red-400/70">{error}</p>}
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[9px] text-white/15 tracking-widest pointer-events-none" style={{ zIndex: 40 }}>
        tap card to change color · drag to move
      </div>

      <div className="absolute bottom-6 right-6 flex gap-2" style={{ zIndex: 40 }}>
        <button onClick={handleReset} className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
        <button onClick={addPad} className="w-9 h-9 rounded-full flex items-center justify-center text-base"
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
          +
        </button>
      </div>
    </div>
  );
}
