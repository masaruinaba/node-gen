'use client';

import { useCallback, useEffect, useRef } from 'react';
import { PAD_CONFIG } from '@/lib/padConfig';

let sharedCtx: AudioContext | null = null;
function getCtx() {
  if (!sharedCtx) sharedCtx = new AudioContext();
  return sharedCtx;
}

interface ToneDef {
  freq: number | [number, number];
  dur: number;
  wave: OscillatorType;
  vol: number;
}

const TONES: Record<string, ToneDef> = {
  tick:      { freq: 1800,         dur: 0.012, wave: 'sine',     vol: 0.15 },
  dragTick:  { freq: 1400,         dur: 0.006, wave: 'sine',     vol: 0.06 },
  snap:      { freq: [1200, 1600], dur: 0.025, wave: 'sine',     vol: 0.18 },
  snapOff:   { freq: [1400, 1000], dur: 0.018, wave: 'sine',     vol: 0.10 },
  select:    { freq: [800, 1200],  dur: 0.045, wave: 'triangle', vol: 0.15 },
  boundary:  { freq: 300,          dur: 0.025, wave: 'sine',     vol: 0.12 },
};

export type SoundName = keyof typeof TONES;

export function useSound(enabled = true) {
  const on = useRef(enabled);
  useEffect(() => { on.current = enabled; }, [enabled]);

  const lastTickTime = useRef(0);
  const lastTickPos = useRef({ x: 0, y: 0 });

  const play = useCallback((name: SoundName, x = 0, y = 0) => {
    if (!on.current) return;
    const t = TONES[name];
    if (!t) return;

    try {
      const c = getCtx();
      const { pitchMod, volumeMod } = PAD_CONFIG.sound;
      const pitchMul = 1 + x * pitchMod;
      const volMul = Math.max(0.3, Math.min(1.7, 1 + y * volumeMod));

      const gain = c.createGain();
      gain.connect(c.destination);
      gain.gain.setValueAtTime(t.vol * volMul, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t.dur);

      const osc = c.createOscillator();
      osc.type = t.wave;
      if (Array.isArray(t.freq)) {
        osc.frequency.setValueAtTime(t.freq[0] * pitchMul, c.currentTime);
        osc.frequency.linearRampToValueAtTime(t.freq[1] * pitchMul, c.currentTime + t.dur);
      } else {
        osc.frequency.setValueAtTime(t.freq * pitchMul, c.currentTime);
      }
      osc.connect(gain);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + t.dur + 0.05);
    } catch { /* AudioContext unavailable (SSR / old browser) */ }
  }, []);

  const dragTick = useCallback((x: number, y: number) => {
    if (!on.current) return;
    const now = performance.now();
    const { rateLimitMs, moveThreshold } = PAD_CONFIG.sound;
    if (now - lastTickTime.current < rateLimitMs) return;

    const dx = x - lastTickPos.current.x;
    const dy = y - lastTickPos.current.y;
    if (Math.sqrt(dx * dx + dy * dy) < moveThreshold) return;

    lastTickTime.current = now;
    lastTickPos.current = { x, y };
    play('dragTick', x, y);
  }, [play]);

  const resetDrag = useCallback(() => {
    lastTickTime.current = 0;
  }, []);

  return { play, dragTick, resetDrag };
}
