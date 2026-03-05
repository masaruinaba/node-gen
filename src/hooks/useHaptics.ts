'use client';

import { useCallback, useEffect } from 'react';

type TriggerInput = string | number | number[];

let instance: any = null;

export function useHaptics() {
  useEffect(() => {
    if (instance) return;
    import('web-haptics').then(mod => {
      instance = new (mod as any).WebHaptics();
      // iOSのhidden switchをDOMに事前追加しておく
      // (trigger内部のensureDOM()を呼ぶため。ジェスチャー外なのでハプティクスは鳴らない)
      instance.trigger([{ duration: 0 }]).catch(() => {});
    }).catch(() => {});
  }, []);

  return useCallback((input?: TriggerInput) => {
    try { instance?.trigger(input); } catch {}
  }, []);
}
