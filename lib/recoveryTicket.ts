// 思い出ログインの「引換券」を作る・確かめる処理です。
// サーバー側（app/api/recovery/）からだけ使います。"use client" のファイルから読み込まないこと。
//
// ▼ なぜ要るのか
//   復旧の申請は、誰でも止められるように、コミュニティの全員に見せています。
//   つまり申請の番号（requestId）は、同じコミュニティの人なら誰でも知ることができます。
//   前は「番号だけ」でログインの鍵を渡していたので、
//   24時間たつと、同じコミュニティの別の人が本人になりすましてログインできてしまいました。
//
// ▼ どう防ぐか
//   申請が立った瞬間に、申請した本人のブラウザにだけ「引換券」を渡します。
//   引換券は、申請の番号に、サーバーしか知らない鍵で署名（HMAC）したものです。
//   番号を知っていても、鍵が無ければ同じ引換券は作れません。
//   ログインのときは、番号と引換券の両方がそろっていないと通しません。
//
//   DB に何かを保存する必要がないので、表を増やさずに済みます。

import { createHmac, timingSafeEqual } from "node:crypto";

// 署名に使う鍵。
// RECOVERY_SECRET があればそれを使い、無ければ service_role の鍵で代用します。
// HMAC は「鍵から署名を作る」一方通行の計算なので、引換券から鍵が漏れることはありません。
function getSecret() {
  const secret =
    process.env.RECOVERY_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("署名の鍵が設定されていません");
  return secret;
}

// 申請の番号から、引換券を作ります
export function makeTicket(requestId: string) {
  return createHmac("sha256", getSecret())
    .update(`recovery:${requestId}`)
    .digest("hex");
}

// 引換券が、その申請の番号のものかを確かめます
export function isValidTicket(requestId: string, ticket: unknown) {
  if (typeof ticket !== "string") return false;
  const expected = Buffer.from(makeTicket(requestId));
  const given = Buffer.from(ticket);
  // timingSafeEqual = 答え合わせにかかる時間から、正解を少しずつ当てられるのを防ぐ比べ方。
  // 長さが違うとエラーになるので、先に長さを確かめます
  return given.length === expected.length && timingSafeEqual(given, expected);
}
