// ホーム画面に出す中身を、DB から取ってくる処理です。
// page.tsx に全部書くと長くなるので、こちらに分けています。

import { createClient } from "@/lib/supabase/server";

export type Member = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  hasNews: boolean;
};

// selectedId = 今選んでいるコミュニティ。「すべて」なら null。
export async function getHomeData(selectedId: string | null) {
  const supabase = await createClient();

  // ▼ getUser() は、Supabase に問い合わせて本人確認をします。つまり通信1回ぶんです。
  //   communities の取得はこれを待つ必要がないので、同時に出しています。
  //   （ログインの確認はCookieを使って Supabase 側が勝手にやってくれるためです）
  //
  // 絞り込みを書いていないのに自分のぶんだけ返ります。
  // communities は RLS で「メンバーしか読めない」設定なので、DB 側が絞ってくれます。
  const [userResult, { data: communities }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("communities").select("id, name"),
  ]);

  const user = userResult.data.user;

  if (user === null) {
    return { user: null, communities: [], members: [] };
  }

  const targetIds = selectedId
    ? [selectedId]
    : (communities?.map((community) => community.id) ?? []);

  // ▼ 待ち時間を短くする工夫
  //
  // DB への問い合わせは、1回ごとに通信が発生します。
  // await を縦に並べると「1つ終わってから次」になるので、回数ぶん待たされます。
  // Promise.all を使うと、まとめて出して、全部そろうまで1回ぶんの待ちで済みます。
  //
  // 下の2つはどちらも targetIds しか使わないので、同時に出せます。
  // in(...) = 並べた値のどれかに一致するものを取る
  const [{ data: memberships }, { data: recentPosts }] = await Promise.all([
    supabase.from("memberships").select("user_id").in("community_id", targetIds),
    // 「最近」は、このコミュニティの新しい投稿20件ぶん、ということにします
    supabase
      .from("posts")
      .select("author_id")
      .in("community_id", targetIds)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // 同じ人が複数のコミュニティにいると id が重複します。
  // Set は同じものを1つしか持てないので、通すと重複が消えます。
  const memberIds = Array.from(
    new Set(memberships?.map((membership) => membership.user_id) ?? []),
  );

  // これは memberIds が決まらないと出せないので、上の後になります
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", memberIds);

  const recentAuthorIds = recentPosts?.map((post) => post.author_id) ?? [];

  const members: Member[] =
    profiles?.map((profile) => ({
      id: profile.id,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      hasNews: recentAuthorIds.includes(profile.id),
    })) ?? [];

  // 光る人を先に並べる
  members.sort((a, b) => (a.hasNews === b.hasNews ? 0 : a.hasNews ? -1 : 1));

  return { user, communities: communities ?? [], members };
}
