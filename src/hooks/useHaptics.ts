'use client';

import { useCallback, useEffect } from 'react';

type TriggerInput = string | number | number[];

let instance: any = null;

export function useHaptics() {
  useEffect(() => {
    if (instance) return;
    import('web-haptics').then(mod => {
      instance = new (mod as any).WebHaptics();
    }).catch(() => {});
  }, []);

  return useCallback((input?: TriggerInput) => {
    try { instance?.trigger(input); } catch {}
  }, []);
}
