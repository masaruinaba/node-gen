export const PAD_CONFIG = {
  cross: {
    normalAlpha: 0.28,
    axisAlpha: 0.62,
    intersectionAlpha: 0.88,
  },

  bg: {
    followLerp: 0.10,
    warmHue: 25,
    coolHue: 220,
    baseSat: 40,
    baseLightness: 58,
    xHueShift: 50,
    xSatShift: 18,
    yLightnessShift: 12,
    energySatBoost: 14,
    energyLightBoost: 6,
  },

  magnetic: {
    sigma: 0.18,
    baseStrength: 0.45,
    dragBoost: 0.5,
    energyBoost: 0.20,
  },

  energy: {
    lerpSpeed: 0.08,
    speedMultiplier: 35,
    dragFloor: 0.05,
  },

  sound: {
    rateLimitMs: 100,
    moveThreshold: 0.08,
    pitchMod: 0.12,
    volumeMod: 0.20,
  },
};
