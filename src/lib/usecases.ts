// 軸の定義（全場面共通・固定）
// X: -1 = フレンドリー  ↔  +1 = ていねい
// Y: -1 = やさしい      ↔  +1 = はっきり

export interface Mission {
  id: string;
  text: string;        // ミッション文（子供向け）
  sampleInput: string; // ワンクリックで入るサンプル
}

export interface UseCase {
  id: string;
  label: string;       // 日本語ラベル（タブ表示）
  description: string; // プロンプト用説明
  target: { x: number; y: number; radius: number };
  samplePrompts: string[];
  missions: Mission[];
}

export const USE_CASES: UseCase[] = [
  {
    id: 'friend',
    label: '友達',
    description: '友達に話しかける',
    target: { x: -0.55, y: 0.1, radius: 0.5 },
    samplePrompts: ['ちょっと待って', 'あとで連絡して', '一緒に遊ぼう'],
    missions: [
      {
        id: 'friend-wait',
        text: '友達に「少し待ってて」って言ってみよう',
        sampleInput: 'ちょっと待って',
      },
      {
        id: 'friend-help',
        text: '友達に「手伝ってほしい」って頼んでみよう',
        sampleInput: '手伝ってほしいんだけど',
      },
      {
        id: 'friend-play',
        text: '友達を遊びに誘ってみよう',
        sampleInput: '今日一緒に遊べる？',
      },
    ],
  },
  {
    id: 'teacher',
    label: '先生',
    description: '先生や目上の人に話しかける',
    target: { x: 0.55, y: 0.2, radius: 0.45 },
    samplePrompts: ['明日の時間を少し変えたい', '質問があります', 'わからないことがあります'],
    missions: [
      {
        id: 'teacher-reschedule',
        text: '先生に「明日の時間を変えたい」って伝えてみよう',
        sampleInput: '明日の時間を少し変えたいです',
      },
      {
        id: 'teacher-question',
        text: '先生に「わからないことを聞いてみよう」',
        sampleInput: 'この問題がわからないので教えてほしいです',
      },
    ],
  },
  {
    id: 'shop',
    label: 'お店',
    description: 'お店の人に聞いたりお願いする',
    target: { x: 0.35, y: 0.15, radius: 0.5 },
    samplePrompts: ['これのサイズはありますか', 'いくらですか', 'これをください'],
    missions: [
      {
        id: 'shop-size',
        text: 'お店の人に「このサイズはありますか」って聞いてみよう',
        sampleInput: 'これのサイズはありますか',
      },
      {
        id: 'shop-price',
        text: 'お店の人に「これはいくらですか」って聞いてみよう',
        sampleInput: 'これはいくらですか',
      },
    ],
  },
  {
    id: 'family',
    label: '家族',
    description: '家族に話しかける（くだけた場面）',
    target: { x: -0.35, y: -0.25, radius: 0.55 },
    samplePrompts: ['お腹すいた', 'ちょっと聞いていい？', 'お願いがあるんだけど'],
    missions: [
      {
        id: 'family-hungry',
        text: '家族に「お腹がすいた」って言ってみよう',
        sampleInput: 'お腹すいた',
      },
      {
        id: 'family-request',
        text: '家族に「お願いがある」って伝えてみよう',
        sampleInput: 'ちょっとお願いがあるんだけど',
      },
    ],
  },
  {
    id: 'apology',
    label: '謝る',
    description: 'ごめんなさいを伝える',
    target: { x: 0.45, y: -0.5, radius: 0.45 },
    samplePrompts: ['遅れてしまいました', '約束を忘れていました', 'ごめんなさい'],
    missions: [
      {
        id: 'apology-late',
        text: '遅れてしまったことを、ちゃんと謝ってみよう',
        sampleInput: '遅れてしまいました',
      },
      {
        id: 'apology-forgot',
        text: '約束を忘れていたことを謝ってみよう',
        sampleInput: '約束を忘れていました',
      },
    ],
  },
  {
    id: 'request',
    label: 'お願い',
    description: '誰かに何かをお願いする',
    target: { x: 0.2, y: 0.0, radius: 0.5 },
    samplePrompts: ['手伝ってもらえますか', '教えてもらえますか', 'もう少し時間をください'],
    missions: [
      {
        id: 'request-help',
        text: '誰かに「手伝ってください」とお願いしてみよう',
        sampleInput: '手伝ってもらえますか',
      },
      {
        id: 'request-teach',
        text: '「教えてもらえませんか」とお願いしてみよう',
        sampleInput: 'これを教えてもらえますか',
      },
    ],
  },
];

export function getUseCase(id: string): UseCase {
  return USE_CASES.find(u => u.id === id) ?? USE_CASES[0];
}
