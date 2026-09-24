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
//   発表が終わったら supabase/03_clear_demo_guests.sql で、まとめて消せます。
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

// ▼ ゲストに「前からの知り合い」のふりをしてもらうための、ダミーの人たち（supabase/02_seed.sql）
//   ゲストは作られたばかりなので、そのままだと誰ともやりとりの記録がありません。
//   それでは「最後に話したのは何年前」が見せられないので、
//   ダミーの何人かと、昔やりとりしたことにしておきます。
//   daysAgo = 何日前にやりとりしたことにするか
const PAST_CONTACTS = [
  { userId: "11111111-1111-4111-8111-000000000001", kind: "card", daysAgo: 3 * 365 + 20 }, // 齋藤 健介：3年前
  { userId: "11111111-1111-4111-8111-000000000003", kind: "reaction", daysAgo: 400 }, // 佐藤 美咲：1年前
  { userId: "11111111-1111-4111-8111-000000000005", kind: "comment", daysAgo: 150 }, // 高橋 結衣：5か月前
  { userId: "11111111-1111-4111-8111-000000000002", kind: "card", daysAgo: 12 }, // 山田 太郎：12日前
];

// ふみばこに最初から1通届いている「ようこそ」のカードの送り主（井上 颯太）。
// 絵は public/demo/cards/welcome.jpg です。アプリのカード画面で「ありがとう」の背景に文字を書いて送り、
// 保存されたものをそのまま使っています（ユーザーが作れるカードと同じ形にするため）
const WELCOME_CARD_FROM = "11111111-1111-4111-8111-000000000010";

const DAY = 24 * 60 * 60 * 1000;

export async function POST() {
  const communityId = process.env.DEMO_COMMUNITY_ID;
  if (!communityId) {
    return NextResponse.json({ error: "デモは使えません" }, { status: 404 });
  }

  const admin = createAdminClient();

  // ▼ 0. 先に、デモ用コミュニティがあるかを確かめます。
  //   無いまま進むと、ゲストのアカウントだけ作られて、入る先が無くて止まってしまいます
  //   （supabase/02_seed.sql をまだ流していないとき）
  const { data: community } = await admin
    .from("communities")
    .select("id")
    .eq("id", communityId)
    .maybeSingle();
  if (!community) {
    console.error("demo login: demo community not found. supabase/02_seed.sql を流してください");
    return NextResponse.json({ error: "デモの準備ができていません" }, { status: 500 });
  }

  // ▼ 1. 使い捨てのアカウントを作ります。
  //   名前とアイコンを入れておくと、DB の仕組み（handle_new_user）がプロフィールも作ってくれます。
  //   アイコンは、public/demo/avatars/ に置いたゲスト用の6枚から、ばらばらに選びます
  //   （前は外部の写真サービスの顔写真で、海外の人ばかりで SNS らしくなかったため）
  const number = Math.floor(100 + Math.random() * 900);
  const email = `guest-${crypto.randomUUID().slice(0, 8)}@${DEMO_EMAIL_DOMAIN}`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    // email_confirm = 「メールの確認は済んでいる」扱いにします（確認のメールは送りません）
    email_confirm: true,
    user_metadata: {
      full_name: `ゲスト ${number}`,
      avatar_url: `/demo/avatars/guest-${Math.floor(1 + Math.random() * 6)}.svg`,
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

  // ▼ 2.5 デモを見せるための下ごしらえ（上の PAST_CONTACTS / WELCOME_CARD_FROM）。
  //   ダミーの人がいない（02_seed.sql を流していない）ときは失敗しますが、
  //   ログインそのものには関係ないので、記録だけ残して先へ進みます
  const guestId = created.user.id;
  const { error: historyError } = await admin.from("interactions").insert(
    PAST_CONTACTS.map((contact) => ({
      user_a: guestId,
      user_b: contact.userId,
      kind: contact.kind,
      occurred_at: new Date(Date.now() - contact.daysAgo * DAY).toISOString(),
    })),
  );
  if (historyError) console.error("demo login: past contacts failed", historyError);

  const { data: template } = await admin
    .from("card_templates")
    .select("id")
    .eq("kind", "thanks")
    .maybeSingle();
  const { error: cardError } = await admin.from("card_sends").insert({
    template_id: template?.id,
    from_user: WELCOME_CARD_FROM,
    to_user: guestId,
    community_id: communityId,
    // / で始まるものは、アプリの public/ の画像としてそのまま出します（lib/signedUrls.ts）
    drawing_url: "/demo/cards/welcome.jpg",
  });
  if (cardError) console.error("demo login: welcome card failed", cardError);

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
