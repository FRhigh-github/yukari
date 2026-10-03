// 文字が uuid（DB の id の形）かどうかを確かめます。
//
// URL の中の id は、誰でも好きな文字に書き換えられます。
// そのまま DB への問い合わせの文字（.or("id.eq.…") など）に埋め込むと、
// 「,」や「(」を混ぜて、問い合わせの条件を書き足されるおそれがあります。
// 使う前にこの形かを確かめ、違えば「見つからない」として扱います。
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
