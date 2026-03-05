'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'tiny-words-pinned';
const MAX_PINNED = 3;

export interface PinnedItem {
  id: string;
  text: string;
  usecaseId: string;
  missionId: string;
  x: number;
  y: number;
  pinnedAt: number;
}

export function usePinnedItems() {
  const [items, setItems] = useState<PinnedItem[]>([]);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const pin = useCallback((entry: Omit<PinnedItem, 'id' | 'pinnedAt'>): boolean => {
    let added = false;
    setItems(prev => {
      if (prev.some(p => p.text === entry.text)) return prev;
      if (prev.length >= MAX_PINNED) return prev;
      added = true;
      return [
        { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, pinnedAt: Date.now() },
        ...prev,
      ];
    });
    return added;
  }, []);

  const unpin = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  return { items, pin, unpin, isFull: items.length >= MAX_PINNED };
}
