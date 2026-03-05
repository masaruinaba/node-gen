'use client';

import { useCallback } from 'react';

type TriggerInput = string | number | number[];

const VIBRATE_PRESETS: Record<string, number[]> = {
  light:   [12],
  success: [30, 60, 40],
  nudge:   [80, 80, 50],
  warning: [40, 100, 40],
  error:   [40, 40, 40, 40, 40],
};

function triggerHaptic(input?: TriggerInput) {
  if (typeof window === 'undefined') return;

  // Android: Vibration API
  if (navigator.vibrate) {
    if (typeof input === 'number') {
      navigator.vibrate(input);
    } else if (Array.isArray(input)) {
      navigator.vibrate(input);
    } else if (typeof input === 'string' && VIBRATE_PRESETS[input]) {
      navigator.vibrate(VIBRATE_PRESETS[input]);
    } else {
      navigator.vibrate(25);
    }
    return;
  }

  // iOS Safari 17.4+: create → toggle → remove (ios-haptics と同じ方式)
  // label で包んで label.click() する必要がある（input.click() では発火しない）
  const label = document.createElement('label');
  label.ariaHidden = 'true';
  label.style.display = 'none';
  const el = document.createElement('input');
  el.type = 'checkbox';
  el.setAttribute('switch', '');
  label.appendChild(el);
  document.head.appendChild(label);
  label.click();
  document.head.removeChild(label);
}

export function useHaptics() {
  return useCallback((input?: TriggerInput) => {
    try { triggerHaptic(input); } catch {}
  }, []);
}
