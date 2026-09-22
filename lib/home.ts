// ホーム画面に出す中身を、DB から取ってくる処理です。
// page.tsx に全部書くと長くなるので、こちらに分けています。

import { createClient } from "@/lib/supabase/server";

export type Member = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  hasNews: boolean;
  // 長押しで出す小さなプロフィールに使います。
  // 同じ問い合わせのついでに取れるので、待ち時間は増えません。
  birthday: string | null;
  mood: string | null;
};

// 待ち中の復旧申請。コミュニティ全員に見せるためのものです
export type RecoveryRequest = {
  id: string;
  targetUser: string;
  targetName: string;
};

// selectedId = URL の ?c= で指定されたコミュニティ。
// 指定がなければ、持っているものの一番上を自動で選びます。
// 「すべて」をやめたのは、別のコミュニティの人が同じ相関図に混ざると
// 今どこを見ているのか分からなくなるためです。
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
    return {
      user: null,
      communities: [],
      members: [],
      currentId: null,
      recoveryRequests: [],
    };
  }

  // 指定された id が自分の持ちものに無いときは、無視して一番上に戻します。
  // （他の人のURLをそのまま開いたときなど）
  const list = communities ?? [];
  const currentId =
    list.find((community) => community.id === selectedId)?.id ??
    list[0]?.id ??
    null;

  if (currentId === null) {
    return {
      user,
      communities: list,
      members: [],
      currentId: null,
      recoveryRequests: [],
    };
  }

  const targetIds = [currentId];

  // ▼ 待ち時間を短くする工夫
  //
  // DB への問い合わせは、1回ごとに通信が発生します。
  // await を縦に並べると「1つ終わってから次」になるので、回数ぶん待たされます。
  // Promise.all を使うと、まとめて出して、全部そろうまで1回ぶんの待ちで済みます。
  //
  // 下の2つはどちらも targetIds しか使わないので、同時に出せます。
  // in(...) = 並べた値のどれかに一致するものを取る
  const [{ data: memberships }, { data: recentPosts }, { data: recoveries }] =
    await Promise.all([
      // ※ profiles を一緒に持ってくる書き方も試しましたが、DBが応じませんでした。
      //   memberships.user_id が profiles ではなく auth.users を指しているためです。
      //   減らすなら、DB側に関数を作る形になります。
      supabase
        .from("memberships")
        .select("user_id")
        .in("community_id", targetIds),
      // 「最近」は、このコミュニティの新しい投稿20件ぶん、ということにします
      supabase
        .from("posts")
        .select("author_id")
        .in("community_id", targetIds)
        .order("created_at", { ascending: false })
        .limit(20),

      // 待ち中の復旧申請。コミュニティ全員に見せて、誰でも止められるようにします
      supabase
        .from("recovery_requests")
        .select("id, target_user, requested_at")
        .eq("community_id", currentId)
        .eq("status", "pending"),
    ]);

  // 同じ人が複数のコミュニティにいると id が重複します。
  // Set は同じものを1つしか持てないので、通すと重複が消えます。
  const memberIds = Array.from(
    new Set(memberships?.map((membership) => membership.user_id) ?? []),
  );

  // これは memberIds が決まらないと出せないので、上の後になります
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, birthday, mood")
    .in("id", memberIds);

  const recentAuthorIds = recentPosts?.map((post) => post.author_id) ?? [];

  const members: Member[] =
    profiles?.map((profile) => ({
      id: profile.id,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      hasNews: recentAuthorIds.includes(profile.id),
      birthday: profile.birthday,
      mood: profile.mood,
    })) ?? [];

  // 光る人を先に並べる
  members.sort((a, b) => (a.hasNews === b.hasNews ? 0 : a.hasNews ? -1 : 1));

  // 申請には名前が入っていないので、メンバーの並びから引いて添えます
  const recoveryRequests: RecoveryRequest[] =
    recoveries?.map((recovery) => ({
      id: recovery.id,
      targetUser: recovery.target_user,
      targetName:
        members.find((member) => member.id === recovery.target_user)
          ?.displayName ?? "どなたか",
    })) ?? [];

  return { user, communities: list, members, currentId, recoveryRequests };
}
