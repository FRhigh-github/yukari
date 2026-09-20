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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user === null) {
    return { user: null, communities: [], members: [] };
  }

  // 絞り込みを書いていないのに自分のぶんだけ返ります。
  // communities は RLS で「メンバーしか読めない」設定なので、DB 側が絞ってくれます。
  const { data: communities } = await supabase
    .from("communities")
    .select("id, name");

  const targetIds = selectedId
    ? [selectedId]
    : (communities?.map((community) => community.id) ?? []);

  // in(...) = 並べた値のどれかに一致するものを取る
  const { data: memberships } = await supabase
    .from("memberships")
    .select("user_id")
    .in("community_id", targetIds);

  // 同じ人が複数のコミュニティにいると id が重複します。
  // Set は同じものを1つしか持てないので、通すと重複が消えます。
  const memberIds = Array.from(
    new Set(memberships?.map((membership) => membership.user_id) ?? []),
  );

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", memberIds);

  // 「最近」は、このコミュニティの新しい投稿20件ぶん、ということにします
  const { data: recentPosts } = await supabase
    .from("posts")
    .select("author_id")
    .in("community_id", targetIds)
    .order("created_at", { ascending: false })
    .limit(20);

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
