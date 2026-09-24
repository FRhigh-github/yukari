// 発表用の「デモで入る」ボタンの裏側です。POST /api/demo-login
//
// ▼ なぜ要るのか
//   発表は4分しかなく、新しく登録するところから見せると、それだけで時間が終わってしまいます。
//   そこで、ボタン1つで、投稿やメンバーがそろったデモ用のコミュニティに入れるようにします。
//
// ▼ 押した人ごとに、使い捨てのアカウントを作ります
//   1つのアカウントをみんなで使うと、10人が送ったお祝いが全部「同じ人から」になり、
//   誰かが投稿を消すと、発表中にデモのデータが消えてしまいます。
//   なので、押すたびに「ゲスト 123」のような新しいアカウントを作って、デモ用のコミュニティに入れます。
//   各自が自分の名前で投稿やお祝いを送れて、ほかの人と混ざりません。
//
//   使い捨てのアカウントは、メールアドレスの最後が @demo.yukari.invalid になっています。
//   （.invalid は「実在しない」と決められた名前なので、メールがどこかへ届くことはありません）
//   発表が終わったら supabase/91_clear_demo_users.sql で、まとめて消せます。
//
// ▼ ログインのさせ方（思い出ログイン app/api/recovery/complete と同じやり方です）
//   作ったアカウントはパスワードを持たないので、サーバーが service_role の鍵で
//   「1回だけ使えるログインの合言葉」を作り、その場で使ってログイン状態（Cookie）にします。
//
// ▼ 安全のためのスイッチ
//   環境変数 DEMO_COMMUNITY_ID に、デモ用コミュニティの id が入っているときだけ動きます。
//   入っている間は、誰でもアカウントを作ってそのコミュニティに入れてしまうので、
//   発表が終わったら、Vercel の環境変数から DEMO_COMMUNITY_ID を消してください（ボタンも消えます）。

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DEMO_EMAIL_DOMAIN } from "@/lib/demoGuest";


export async function POST() {
  const communityId = process.env.DEMO_COMMUNITY_ID;
  if (!communityId) {
    return NextResponse.json({ error: "デモは使えません" }, { status: 404 });
  }

  const admin = createAdminClient();

  // ▼ 0. 先に、デモ用コミュニティがあるかを確かめます。
  //   無いまま進むと、ゲストのアカウントだけ作られて、入る先が無くて止まってしまいます
  //   （supabase/92_demo_community.sql をまだ流していないとき）
  const { data: community } = await admin
    .from("communities")
    .select("id")
    .eq("id", communityId)
    .maybeSingle();
  if (!community) {
    console.error("demo login: demo community not found. 92_demo_community.sql を流してください");
    return NextResponse.json({ error: "デモの準備ができていません" }, { status: 500 });
  }

  // ▼ 1. 使い捨てのアカウントを作ります。
  //   名前とアイコンを入れておくと、DB の仕組み（handle_new_user）がプロフィールも作ってくれます。
  //   アイコンは、ダミーの10人と同じ写真のサービスから、番号をばらばらに選びます
  const number = Math.floor(100 + Math.random() * 900);
  const email = `guest-${crypto.randomUUID().slice(0, 8)}@${DEMO_EMAIL_DOMAIN}`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    // email_confirm = 「メールの確認は済んでいる」扱いにします（確認のメールは送りません）
    email_confirm: true,
    user_metadata: {
      full_name: `ゲスト ${number}`,
      avatar_url: `https://i.pravatar.cc/200?img=${Math.floor(1 + Math.random() * 70)}`,
    },
  });

  if (createError || !created.user) {
    console.error("demo login: createUser failed", createError);
    return NextResponse.json({ error: "デモに入れませんでした" }, { status: 500 });
  }

  // ▼ 2. デモ用のコミュニティに入れます。
  //   招待コードを入れる手間も飛ばすため、ここでメンバーにしてしまいます
  const { error: joinError } = await admin
    .from("memberships")
    .insert({ user_id: created.user.id, community_id: communityId, role: "member" });

  if (joinError) {
    console.error("demo login: join failed", joinError);
    // 入れなかったゲストのアカウントは、残さずに消します
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "デモに入れませんでした" }, { status: 500 });
  }

  // ▼ 3. 1回だけ使えるログインの合言葉を作り、その場でログイン状態に変えます。
  //   ここ（route.ts）では Cookie を書けるので、ブラウザにログイン状態が保存されます
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error("demo login: generateLink failed", linkError);
    return NextResponse.json({ error: "デモに入れませんでした" }, { status: 500 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (error) {
    console.error("demo login: verifyOtp failed", error);
    return NextResponse.json({ error: "デモに入れませんでした" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
