'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  extractAudioFeatures, makePrevState,
  type AudioFeatures, DEFAULT_AUDIO_FEATURES,
} from '@/lib/audioFeatures';

const FFT_SIZE = 1024;
export const NUM_BANDS = 16;
const SMOOTHING = 0.6;

function extractBands(data: Uint8Array): number[] {
  const bands: number[] = [];
  const step = Math.floor(data.length / NUM_BANDS);
  for (let i = 0; i < NUM_BANDS; i++) {
    let sum = 0;
    const start = i * step;
    const end = Math.min(start + step, data.length);
    for (let j = start; j < end; j++) sum += data[j];
    bands.push(sum / ((end - start) * 255));
  }
  return bands;
}

export type { AudioFeatures };

export function useAudioReactive() {
  const [bands, setBands] = useState<number[]>(Array(NUM_BANDS).fill(0));
  const [features, setFeatures] = useState<AudioFeatures>(DEFAULT_AUDIO_FEATURES);
  const [isActive, setIsActive] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const prevStateRef = useRef(makePrevState());

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    analyserRef.current = null;
    dataRef.current = null;
    prevStateRef.current = makePrevState();
    setIsActive(false);
    setBands(Array(NUM_BANDS).fill(0));
    setFeatures(DEFAULT_AUDIO_FEATURES);
  }, []);

  const startLoop = useCallback(() => {
    const tick = () => {
      if (!analyserRef.current || !dataRef.current) return;
      analyserRef.current.getByteFrequencyData(dataRef.current);
      setBands(extractBands(dataRef.current));
      setFeatures(extractAudioFeatures(dataRef.current, prevStateRef.current));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    setIsActive(true);
  }, []);

  const setupAnalyser = useCallback((ctx: AudioContext, source: AudioNode, connectDest = false) => {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING;
    source.connect(analyser);
    if (connectDest) source.connect(ctx.destination);
    analyserRef.current = analyser;
    dataRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
    startLoop();
  }, [startLoop]);

  const connectMic = useCallback(async () => {
    stop();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    streamRef.current = stream;
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    setupAnalyser(ctx, ctx.createMediaStreamSource(stream));
  }, [stop, setupAnalyser]);

  const connectUrl = useCallback((audioEl: HTMLAudioElement) => {
    stop();
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const source = ctx.createMediaElementSource(audioEl);
    setupAnalyser(ctx, source, true);
  }, [stop, setupAnalyser]);

  useEffect(() => () => { stop(); }, [stop]);

  return { bands, features, isActive, connectMic, connectUrl, stop };
}
