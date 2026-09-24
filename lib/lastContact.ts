// 「最後に話したのは何年前」を、画面に出す言葉にする処理です。
//
// 日時そのものは DB の last_contacts（ビュー）から取ってきます。
// カード・お祝い・チャットを送ると、DB のトリガーが自動で記録しています
// （supabase/01_schema.sql の interactions）。
//
// ▼ サーバーで計算する理由
//   「今」からの差を、サーバーとブラウザの両方で計算すると、
//   ちょうど境目のときに結果が食い違い、表示がずれることがあります。
//   サーバーで1回だけ計算して、できた言葉を画面に渡します。

const DAY = 24 * 60 * 60 * 1000;

// 最後にやりとりしてから、何年たったか（1年未満は 0）。やりとりが無ければ null
export function yearsSince(lastAt: string | null): number | null {
  if (lastAt === null) return null;
  const days = Math.floor((Date.now() - new Date(lastAt).getTime()) / DAY);
  return Math.floor(days / 365);
}

// 「3年前」「5か月前」「12日前」「今日」の形にします。やりとりが無ければ null
export function formatLastContact(lastAt: string | null): string | null {
  if (lastAt === null) return null;
  const days = Math.floor((Date.now() - new Date(lastAt).getTime()) / DAY);
  if (days < 1) return "今日";
  if (days < 30) return `${days}日前`;
  if (days < 365) return `${Math.floor(days / 30)}か月前`;
  return `${Math.floor(days / 365)}年前`;
}
