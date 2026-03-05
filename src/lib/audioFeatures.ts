export interface AudioFeatures {
  rms: number;      // 0..1  overall energy (root mean square)
  centroid: number; // 0..1  spectral centroid (normalized brightness/tone)
  peak: number;     // 0..1  transient strength (sharp rise in energy)
  flux: number;     // 0..1  spectral flux (rate of spectral change)
  t: number;        // ms    timestamp
}

export const DEFAULT_AUDIO_FEATURES: AudioFeatures = {
  rms: 0, centroid: 0, peak: 0, flux: 0, t: 0,
};

/** 前フレームの状態（hookのrefに持たせる用） */
export interface PrevAudioState {
  data: Uint8Array | null;
  rms: number;
}

export function makePrevState(): PrevAudioState {
  return { data: null, rms: 0 };
}

/**
 * FFT データから音響特徴量を抽出する純粋関数。
 * prev は hookのref で管理し、呼び出しごとに更新すること。
 */
export function extractAudioFeatures(
  data: Uint8Array,
  prev: PrevAudioState,
): AudioFeatures {
  const n = data.length;
  let sumSq = 0;
  let weightedSum = 0;
  let totalSum = 0;
  let flux = 0;

  for (let i = 0; i < n; i++) {
    const v = data[i] / 255;
    sumSq += v * v;
    weightedSum += v * i;
    totalSum += v;

    if (prev.data) {
      const diff = (data[i] - prev.data[i]) / 255;
      if (diff > 0) flux += diff * diff; // positive-only flux (onset detection)
    }
  }

  const rms = Math.min(1, Math.sqrt(sumSq / n) * 2.5);
  const centroid = totalSum > 0.001 ? Math.min(1, (weightedSum / totalSum / n) * 2.5) : 0;
  flux = Math.min(1, Math.sqrt(flux / n) * 4);

  // Peak = sharp rise from previous frame (= onset strength)
  const smoothedPrevRms = prev.rms * 0.85 + rms * 0.15;
  const peak = Math.min(1, Math.max(0, (rms - smoothedPrevRms) * 10));

  // Update prev state in-place (caller owns the object)
  prev.rms = smoothedPrevRms;
  if (!prev.data || prev.data.length !== n) {
    prev.data = new Uint8Array(n);
  }
  prev.data.set(data);

  return { rms, centroid, peak, flux, t: performance.now() };
}
