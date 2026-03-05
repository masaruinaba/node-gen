/**
 * nodeGraph.ts — グラフ評価器
 *
 * ノードを接続順（トポロジカル順）に評価し、
 * 各ノードの RenderState を計算して返す。
 *
 * エッジは「無向」で持ち、カテゴリ優先度によって信号の流れる方向を決定する:
 *   input(3) → effect(2) → color(1) → generator(0)
 * 同一優先度同士はシグナル流れなし（両方がベース音響シグナルを独立に受ける）。
 */

import type { AudioFeatures } from './audioFeatures';
import {
  NODE_TYPES, CATEGORY_PRIORITY,
  applyNode, audioToBase, mergeSignals,
  type RenderState, type NodeParams,
} from './nodeTypes';

export interface GraphNode {
  id: string;
  typeId: string;
  params: NodeParams;
}

export interface GraphEdge {
  from: string;
  to: string;
}

/** カテゴリ優先度を返す（未知タイプは generator 扱い） */
function priority(typeId: string): number {
  const cat = NODE_TYPES[typeId]?.category ?? 'generator';
  return CATEGORY_PRIORITY[cat];
}

/** 無向エッジを優先度ベースの有向エッジに変換（同優先度は除外） */
function toDirected(edges: GraphEdge[], nodes: GraphNode[]): GraphEdge[] {
  const pri = new Map(nodes.map(n => [n.id, priority(n.typeId)]));
  const result: GraphEdge[] = [];
  for (const e of edges) {
    const pa = pri.get(e.from) ?? 0;
    const pb = pri.get(e.to)   ?? 0;
    if (pa === pb) continue; // 同優先度は信号なし
    if (pa > pb) result.push(e);
    else result.push({ from: e.to, to: e.from });
  }
  return result;
}

/**
 * グラフ評価（メインエントリ）。
 * 複数パス評価でトポロジカル順を近似（深さ3以下なら3パスで収束）。
 */
export function evaluateGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  features: AudioFeatures,
  t: number,
): Map<string, RenderState> {
  const base = audioToBase(features);
  const outputs = new Map<string, RenderState>();
  const directed = toDirected(edges, nodes);

  // 3パス評価：1パス目はベース信号で全ノードを評価、
  // 2〜3パス目で上流ノードの出力を使って下流を再評価する
  for (let pass = 0; pass < 3; pass++) {
    for (const node of nodes) {
      const pri = priority(node.typeId);

      // このノードへの有向上流エッジからシグナルを収集
      const inputs: RenderState[] = [];
      for (const e of directed) {
        if (e.to === node.id) {
          const upPri = priority(nodes.find(n => n.id === e.from)?.typeId ?? 'grid');
          if (upPri > pri && outputs.has(e.from)) {
            inputs.push(outputs.get(e.from)!);
          }
        }
      }

      const inputSig = inputs.length > 0 ? mergeSignals(inputs) : base;
      // nodeIdSeed: ノードIDを数値化（ノイズ等の固有シード用）
      const seed = node.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
      outputs.set(node.id, applyNode(node.typeId, node.params, inputSig, features, t, seed));
    }
  }

  return outputs;
}
