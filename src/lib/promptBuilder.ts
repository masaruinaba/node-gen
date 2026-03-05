import type { UseCase } from './usecases';

// 軸: X: -1=フレンドリー ↔ +1=ていねい
//      Y: -1=やさしい    ↔ +1=はっきり

const describeX = (x: number): string => {
  if (Math.abs(x) < 0.08) return 'フレンドリーとていねいのちょうど中間';
  const side = x < 0 ? 'フレンドリー' : 'ていねい';
  const pct = Math.round(Math.abs(x) * 100);
  return `${side}寄り（${pct}%）`;
};

const describeY = (y: number): string => {
  if (Math.abs(y) < 0.08) return 'やさしいとはっきりのちょうど中間';
  const side = y < 0 ? 'やさしい' : 'はっきり';
  const pct = Math.round(Math.abs(y) * 100);
  return `${side}寄り（${pct}%）`;
};

export function buildPrompt(
  text: string,
  useCase: UseCase,
  x: number,
  y: number,
): string {
  return `あなたは子供向けの言葉のコーチです。

場面：${useCase.label}（${useCase.description}）
言い方の調整：
- フレンドリー↔ていねい：${describeX(x)}
- やさしい↔はっきり：${describeY(y)}

以下のセリフを、上の場面と調整に合わせて3通りに書き直してください。
セリフ：「${text}」

ルール：
- 子供でもわかる自然な日本語
- 短く（できれば1〜2文）
- 句読点は最小限
- 絵文字なし
- 必ずJSONのみで返す（マークダウン・前置き・説明文は一切不要）

{"main":"...","sub1":"...","sub2":"..."}`;
}
