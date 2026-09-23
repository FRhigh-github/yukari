// 24時間たった申請を、実際のログインに変える処理です。
//
// 通っているかどうかの判定は、DB側の関数（recovery_is_unlocked）に任せます。
// 「24時間たった」「誰にも拒否されていない」を数える場所を1つにするためです。
// ここで自分で数えると、画面側と食い違ったときに気づけません。
//
// 通っていたら、その人のログイン用の合言葉（token_hash）を作って返します。
// 画面側がそれを使うと、ログインした状態になります。
// メールは送りません。本人はメールを見られない前提だからです。

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidTicket } from "@/lib/recoveryTicket";

export async function POST(request: Request) {
  // 送られてきた中身が JSON として読めないときは、ここで断ります
  const body = await request.json().catch(() => null);
  const requestId = body?.requestId;

  if (typeof requestId !== "string") {
    return NextResponse.json({ error: "申請が見つかりません" }, { status: 400 });
  }

  // ▼ 申請した本人しか持っていない「引換券」を確かめます（lib/recoveryTicket.ts）。
  //   申請の番号は同じコミュニティの人なら誰でも見られるので、番号だけでは通しません。
  //   DB に聞く前に断れるので、でたらめな呼び出しで DB を使わせずに済みます
  if (!isValidTicket(requestId, body?.ticket)) {
    return NextResponse.json(
      { error: "この端末からは復旧できません。コードを入れた端末で開いてください" },
      { status: 403 },
    );
  }

  const supabase = createAdminClient();

  const { data: recoveryRequest } = await supabase
    .from("recovery_requests")
    .select("id, target_user, status, requested_at")
    .eq("id", requestId)
    .maybeSingle();

  if (!recoveryRequest) {
    return NextResponse.json({ error: "申請が見つかりません" }, { status: 404 });
  }

  if (recoveryRequest.status === "rejected") {
    return NextResponse.json(
      { error: "この復旧は止められました" },
      { status: 403 },
    );
  }

  // 一度ログインに使った申請は、もう使えません（1回限り）。
  // 前は、通ったあとも何度でもログイン用の合言葉を出せていました
  if (recoveryRequest.status === "approved") {
    return NextResponse.json(
      { error: "この申請はもう使われています" },
      { status: 403 },
    );
  }

  // 24時間たったか＆拒否されていないか。DB側の関数に聞きます
  const { data: unlocked } = await supabase.rpc("recovery_is_unlocked", {
    request: requestId,
  });

  if (unlocked !== true) {
    // まだ待ち時間の最中。あと何分かを画面に返します
    const readyAt = new Date(recoveryRequest.requested_at);
    readyAt.setHours(readyAt.getHours() + 24);

    return NextResponse.json({ waiting: true, readyAt: readyAt.toISOString() });
  }

  // ▼ 合言葉を作る前に、申請を「使用済み（approved）」にします。
  //   .eq("status", "pending") を付けると、まだ使われていないときだけ書き換わるので、
  //   ほぼ同時に2回押されても、合言葉が出るのは先に届いた1回だけになります。
  const { data: claimed } = await supabase
    .from("recovery_requests")
    .update({ status: "approved" })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id");

  if (claimed?.length !== 1) {
    return NextResponse.json(
      { error: "この申請はもう使われています" },
      { status: 403 },
    );
  }

  // 途中で失敗したときは、申請を元（pending）に戻して、もう一度押せるようにします
  const release = () =>
    supabase
      .from("recovery_requests")
      .update({ status: "pending" })
      .eq("id", requestId);

  // ログインさせる相手のメールアドレスを調べます。
  // 本人はこのメールを見られませんが、合言葉を作るのに必要です。
  const { data: userData, error: userError } =
    await supabase.auth.admin.getUserById(recoveryRequest.target_user);

  if (userError || !userData.user?.email) {
    await release();
    return NextResponse.json(
      { error: "この人はメールで登録されていないため、復旧できません" },
      { status: 400 },
    );
  }

  // generateLink は、ふつうはメールで送るリンクを作る命令です。
  // ここではメールを送らず、中身の合言葉だけを受け取って画面に渡します。
  const { data: link, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email,
    });

  if (linkError || !link.properties?.hashed_token) {
    await release();
    return NextResponse.json(
      { error: "ログインの準備に失敗しました" },
      { status: 500 },
    );
  }

  return NextResponse.json({ tokenHash: link.properties.hashed_token });
}
