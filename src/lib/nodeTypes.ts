import type { AudioFeatures } from './audioFeatures';

// ── Categories ────────────────────────────────────────────────────────────────
export type NodeCategory = 'input' | 'generator' | 'effect' | 'color';

export interface NodeType {
  id: string;
  label: string;
  category: NodeCategory;
}

export const NODE_TYPES: Record<string, NodeType> = {
  mic:        { id: 'mic',        label: 'Mic',        category: 'input' },
  noise:      { id: 'noise',      label: 'Noise',      category: 'input' },
  beat:       { id: 'beat',       label: 'Beat',       category: 'input' },
  grid:       { id: 'grid',       label: 'Grid',       category: 'generator' },
  wave:       { id: 'wave',       label: 'Wave',       category: 'generator' },
  particles:  { id: 'particles',  label: 'Particles',  category: 'generator' },
  magnet:     { id: 'magnet',     label: 'Magnet',     category: 'effect' },
  swirl:      { id: 'swirl',      label: 'Swirl',      category: 'effect' },
  ripple:     { id: 'ripple',     label: 'Ripple',     category: 'effect' },
  turbulence: { id: 'turbulence', label: 'Turbulence', category: 'effect' },
  palette:    { id: 'palette',    label: 'Palette',    category: 'color' },
  gradient:   { id: 'gradient',   label: 'Gradient',   category: 'color' },
  hueShift:   { id: 'hueShift',   label: 'Hue Shift',  category: 'color' },
};

export const CATEGORY_PRIORITY: Record<NodeCategory, number> = {
  input: 3, effect: 2, color: 1, generator: 0,
};

export const CATEGORY_COLORS: Record<NodeCategory, string> = {
  input:     'rgba(120,200,255,0.7)',
  generator: 'rgba(255,255,255,0.7)',
  effect:    'rgba(200,160,255,0.6)',
  color:     'rgba(255,180,120,0.7)',
};

export const CATEGORY_BG: Record<NodeCategory, string> = {
  input:     'rgba(120,200,255,0.08)',
  generator: 'rgba(255,255,255,0.06)',
  effect:    'rgba(200,160,255,0.07)',
  color:     'rgba(255,180,120,0.08)',
};

export type GridMode = 'ripple' | 'pulse' | 'breathe';

export interface SignalConfig {
  mode: GridMode;
  propagationSpeed: number;
  pulseThreshold: number;
  breatheCycle: number;
  smoothing: number;
  colorSaturation: number;
  colorBrightness: number;
  opacityRange: [number, number];
  scaleRange: [number, number];
}

export const DEFAULT_SIGNAL_CONFIG: SignalConfig = {
  mode: 'ripple',
  propagationSpeed: 0.06,
  pulseThreshold: 0.45,
  breatheCycle: 3000,
  smoothing: 0.15,
  colorSaturation: 65,
  colorBrightness: 70,
  opacityRange: [0.22, 0.95],
  scaleRange: [0.8, 1.6],
};

export const PALETTES: Record<string, [number, number, number][]> = {
  warm:   [[350, 80, 65], [25, 90, 60], [45, 85, 70]],
  cool:   [[200, 70, 55], [230, 65, 60], [260, 55, 70]],
  neon:   [[320, 100, 60], [170, 100, 55], [60, 100, 65]],
  mono:   [[0, 0, 50], [0, 0, 70], [0, 0, 90]],
  earth:  [[25, 50, 45], [35, 40, 55], [15, 35, 40]],
  aurora: [[280, 85, 60], [165, 90, 55], [200, 80, 65]],
  sunset: [[10, 95, 65], [340, 85, 58], [280, 75, 58]],
  candy:  [[320, 70, 80], [195, 65, 78], [145, 60, 76]],
  ocean:  [[205, 85, 45], [185, 90, 55], [220, 75, 50]],
  lava:   [[15, 100, 50], [30, 100, 55], [0, 90, 60]],
};

// ── RenderState ───────────────────────────────────────────────────────────────
export interface RenderState {
  energy:   number;
  tone:     number;
  pulse:    number;
  colorMix: number;
  palette:  [number, number, number][];
  hueShift: number;
}

export const DEFAULT_RENDER_STATE: RenderState = {
  energy: 0, tone: 0, pulse: 0, colorMix: 0,
  palette: PALETTES.warm, hueShift: 0,
};

// ── Node params ───────────────────────────────────────────────────────────────
export interface NodeParams {
  paletteId?:  string;
  paletteIdA?: string;
  paletteIdB?: string;
  hueAmount?:  number;
  strength?:   number;
  speed?:      number;
  gain?:       number;
  gridMode?:   GridMode;
  hueOffset?:  number;
}

// ── Signal helpers ────────────────────────────────────────────────────────────
function _lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function _avg(arr: number[]) {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

export function mergeSignals(inputs: RenderState[]): RenderState {
  if (!inputs.length) return { ...DEFAULT_RENDER_STATE };
  if (inputs.length === 1) return { ...inputs[0] };
  return {
    energy:   _avg(inputs.map(i => i.energy)),
    tone:     _avg(inputs.map(i => i.tone)),
    pulse:    Math.max(...inputs.map(i => i.pulse)),
    colorMix: Math.max(...inputs.map(i => i.colorMix)),
    palette:  inputs[inputs.length - 1].palette,
    hueShift: inputs.reduce((s, i) => s + i.hueShift, 0) % 360,
  };
}

export function audioToBase(features: AudioFeatures): RenderState {
  return { energy: features.rms, tone: features.centroid, pulse: features.peak, colorMix: features.rms, palette: PALETTES.warm, hueShift: 0 };
}

/** ノードタイプごとのシグナル変換（INPUT→変換なし/EFFECT→加工/COLOR→色注入/GENERATOR→スルー） */
export function applyNode(
  typeId: string,
  params: NodeParams,
  input: RenderState,
  features: AudioFeatures,
  t: number,
  nodeIdSeed: number,
): RenderState {
  switch (typeId) {
    case 'mic':
      return { ...input, energy: features.rms, tone: features.centroid, pulse: features.peak, colorMix: features.rms * (params.gain ?? 1) };
    case 'noise': {
      const n = Math.sin(t * 0.0008 * (params.gain ?? 1) + nodeIdSeed * 3.14) * 0.5 + 0.5;
      const p = n > 0.82 ? (n - 0.82) / 0.18 : 0;
      return { ...input, energy: n, tone: (n + t * 0.00004) % 1, pulse: p, colorMix: n };
    }
    case 'beat':
      return { ...input, energy: Math.min(1, features.peak * (params.gain ?? 1.5)), pulse: features.peak > 0.4 ? 1 : 0, colorMix: features.peak };
    case 'magnet': {
      const s = params.strength ?? 1;
      return { ...input, energy: Math.min(1, input.energy * (1 + s * 0.6)), pulse: Math.min(1, input.pulse * (1 + s * 0.5)) };
    }
    case 'ripple': {
      const ph = Math.sin(t * 0.002 * (params.speed ?? 1) + input.energy * Math.PI) * 0.35;
      return { ...input, energy: Math.min(1, input.energy + Math.abs(ph) * 0.4), tone: (input.tone + Math.abs(ph) * 0.3) % 1 };
    }
    case 'swirl':
      return { ...input, hueShift: (input.hueShift + input.energy * 180 * (params.strength ?? 1)) % 360 };
    case 'turbulence': {
      const s = params.strength ?? 0.25;
      const seed = Math.sin(t * 0.01 + nodeIdSeed) * 0.5;
      return {
        ...input,
        energy: Math.max(0, Math.min(1, input.energy + seed * s)),
        tone:   Math.max(0, Math.min(1, input.tone   + seed * s * 0.5)),
        pulse:  Math.max(0, Math.min(1, input.pulse  + (seed > 0 ? seed * s : 0))),
      };
    }
    case 'palette':
      return { ...input, palette: PALETTES[params.paletteId ?? 'cool'] ?? PALETTES.cool, colorMix: Math.max(input.colorMix, input.energy) };
    case 'gradient': {
      const palA = PALETTES[params.paletteIdA ?? 'warm'] ?? PALETTES.warm;
      const palB = PALETTES[params.paletteIdB ?? 'cool'] ?? PALETTES.cool;
      const mixed: [number, number, number][] = palA.map((colA, i) => {
        const colB = palB[i] ?? colA;
        return [_lerp(colA[0], colB[0], input.tone), _lerp(colA[1], colB[1], input.tone), _lerp(colA[2], colB[2], input.tone)];
      });
      return { ...input, palette: mixed, colorMix: Math.max(input.colorMix, input.energy) };
    }
    case 'hueShift':
      return { ...input, hueShift: (input.hueShift + (params.hueAmount ?? 60) * input.energy) % 360 };
    default:
      return { ...input };
  }
}
