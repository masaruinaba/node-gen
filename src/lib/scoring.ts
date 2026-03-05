// XY空間の最大距離: (-1,-1) → (1,1) = 2√2 ≈ 2.83
const MAX_DIST = Math.sqrt(8);

/** ミッション達成とみなすスコアしきい値 */
export const MISSION_THRESHOLD = 75;

/**
 * 現在位置(x,y)と場面のターゲット中心の距離からスコアを計算する。
 * ターゲット中心で100、離れるほど0に近づく（線形）。
 */
export function calcScore(
  x: number,
  y: number,
  target: { x: number; y: number; radius: number },
): number {
  const dist = Math.sqrt((x - target.x) ** 2 + (y - target.y) ** 2);
  return Math.max(0, Math.round(100 * (1 - dist / MAX_DIST)));
}
