// 3つのコードを受け取って、復旧の申請を立てる処理です。
//
// ここはサーバーの中だけで動きます。
// 本人はまだログインできていないので、画面側では照合できません。
//
// 確かめること
//   ・3つとも実在して、期限内で、まだ使われていない
//   ・3つとも「同じ人の復旧用」である
//   ・発行した3人が、全員ちがう人である  ← 1人で3つ作れないための要
//
// 通ったら、申請を立てて、コードを使用済みにします。
// 申請は24時間後にログインできる状態になります（その間、誰でも止められます）。

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { makeTicket } from "@/lib/recoveryTicket";

export async function POST(request: Request) {
  // 送られてきた中身が JSON として読めないときは、ここで断ります（読めないと処理ごと落ちるため）
  const body = await request.json().catch(() => null);
  const codes = body?.codes;

  // 受け取った形を確かめます。ここを省くと、変な値で落ちます。
  if (!Array.isArray(codes) || codes.length !== 3) {
    return NextResponse.json({ error: "コードを3つ入れてください" }, { status: 400 });
  }

  // 大文字にそろえ、前後の空白を落とします（手入力なので揺れます）
  const cleaned = codes.map((code: string) => String(code).trim().toUpperCase());

  // 同じコードを3回入れていないか
  if (new Set(cleaned).size !== 3) {
    return NextResponse.json(
      { error: "3つとも別のコードを入れてください" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data: found } = await supabase
    .from("recovery_codes")
    .select("code, target_user, issued_by, expires_at, used")
    .in("code", cleaned);

  const valid = (found ?? []).filter(
    (row) => !row.used && new Date(row.expires_at) > new Date(),
  );

  if (valid.length !== 3) {
    return NextResponse.json(
      { error: "コードが違うか、期限が切れています" },
      { status: 400 },
    );
  }

  // 3つとも同じ人の復旧用か
  const targets = new Set(valid.map((row) => row.target_user));
  if (targets.size !== 1) {
    return NextResponse.json(
      { error: "別々の人のコードが混ざっています" },
      { status: 400 },
    );
  }

  // 発行者が3人ともちがうか。ここが乗っ取りを防ぐ要です。
  if (new Set(valid.map((row) => row.issued_by)).size !== 3) {
    return NextResponse.json(
      { error: "3人ちがう人のコードが必要です" },
      { status: 400 },
    );
  }

  const targetUser = valid[0].target_user;

  // どのコミュニティで行われているか。
  // 通知を見せる範囲と、拒否できる人の範囲になります。
  const { data: membership } = await supabase
    .from("memberships")
    .select("community_id")
    .eq("user_id", targetUser)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: "この人はどのコミュニティにも入っていません" },
      { status: 400 },
    );
  }

  // ▼ 使い回せないように、申請を立てる「前に」使用済みにします。
  //   前は申請を立てたあとに使用済みにしていたので、同じ3つのコードを
  //   ほぼ同時に2回送ると、申請が2つ立ってしまうことがありました。
  //   .eq("used", false) を付けると「まだ使われていないものだけ」を書き換えるので、
  //   同時に来ても、先に届いた方しか3件ぶん書き換えられません。
  const { data: marked } = await supabase
    .from("recovery_codes")
    .update({ used: true })
    .in("code", cleaned)
    .eq("used", false)
    .select("code");

  if (marked?.length !== 3) {
    return NextResponse.json(
      { error: "コードが違うか、期限が切れています" },
      { status: 400 },
    );
  }

  const { data: created, error } = await supabase
    .from("recovery_requests")
    .insert({ target_user: targetUser, community_id: membership.community_id })
    .select("id, requested_at")
    .single();

  if (error) {
    // DB のエラー文は、表の名前など中の作りが分かってしまうので、画面には出しません
    console.error("recovery request insert failed", error);
    return NextResponse.json(
      { error: "申請を立てられませんでした。時間をおいて試してください" },
      { status: 500 },
    );
  }

  // 申請した本人にだけ、引換券を渡します（lib/recoveryTicket.ts）。
  // ログインのときに、申請の番号と一緒に出してもらいます
  return NextResponse.json({
    requestId: created.id,
    ticket: makeTicket(created.id),
  });
}
