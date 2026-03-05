/**
 * persistence.ts — グラフシーンの保存・復元・エクスポート
 */

import type { NodeParams, GridMode } from './nodeTypes';

const STORAGE_KEY = 'audio-canvas-scene-v1';

export interface SceneNode {
  id: string;
  typeId: string;
  params: NodeParams;
  cx: number;
  cy: number;
  hueOffset: number;
  paletteId: string;
  gridMode: GridMode;
}

export interface Scene {
  version: 1;
  nodes: SceneNode[];
  savedAt: number;
}

/** PadState から Scene を構築して localStorage に保存 */
export function saveScene(nodes: SceneNode[]): void {
  try {
    const scene: Scene = { version: 1, nodes, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scene));
  } catch {}
}

/** localStorage から Scene を復元（なければ null） */
export function loadScene(): Scene | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const scene = JSON.parse(raw) as Scene;
    if (scene.version !== 1) return null;
    return scene;
  } catch { return null; }
}

/** Scene を JSON ファイルとしてダウンロード */
export function exportScene(nodes: SceneNode[]): void {
  const scene: Scene = { version: 1, nodes, savedAt: Date.now() };
  const blob = new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audio-scene-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** JSON 文字列から Scene をパース（バリデーション付き） */
export function importScene(json: string): Scene | null {
  try {
    const scene = JSON.parse(json) as Scene;
    if (scene.version !== 1 || !Array.isArray(scene.nodes)) return null;
    return scene;
  } catch { return null; }
}
