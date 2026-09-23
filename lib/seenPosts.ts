// 「どの人のご報告を、いつのぶんまで見たか」を覚えておく仕組みです。
//
// ホームで光る（報告がある）のは「まだ見ていない新しいご報告がある人」だけにします。
// 1回見たら光らなくなります。
//
// ▼ どこに覚えておくか
//   DB ではなく、ブラウザの Cookie（小さなメモ）に入れています。
//   Cookie はサーバーにも毎回届くので、ホームを作る時点で「見たかどうか」が分かり、
//   一瞬だけ光ってから消える、というちらつきが起きません。
//   代わりに、端末ごとの記録になります（スマホで見ても、PCでは光ったまま）。
//
// 中身は { "その人のid": "見た中でいちばん新しいご報告の日時" } という形の文字です。

export const SEEN_COOKIE = "yukari-seen";

export type SeenMap = Record<string, string>;

// Cookie の文字から、表の形に戻します。壊れていたら空の表にします
export function parseSeen(value: string | undefined): SeenMap {
  if (!value) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
