// ホーム画面に出す中身を、DB から取ってくる処理です。
// page.tsx に全部書くと長くなるので、こちらに分けています。

import { cookies } from "next/headers";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { SEEN_COOKIE, parseSeen } from "@/lib/seenPosts";
import { formatLastContact, yearsSince } from "@/lib/lastContact";

export type Member = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  hasNews: boolean;
  // 長押しで出す小さなプロフィールに使います。
  // 同じ問い合わせのついでに取れるので、待ち時間は増えません。
  birthday: string | null;
  mood: string | null;
  // 最後にやりとりしてからの時間。「3年前」など。やりとりが無ければ null（lib/lastContact.ts）
  lastContactLabel: string | null;
  // 最後にやりとりしてから何年たったか。1年以上なら、相関図のアイコンに印を付けます
  lastContactYears: number | null;
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

  // ▼ 本人確認（getCurrentUserId）は通信なしで済みます（lib/supabase/server.ts）。
  //   communities の取得はこれを待つ必要がないので、同時に出しています。
  //
  // 絞り込みを書いていないのに自分のぶんだけ返ります。
  // communities は RLS で「メンバーしか読めない」設定なので、DB 側が絞ってくれます。
  //
  // ※ 未来への手紙（✈️）は、既読かどうかをブラウザに覚えさせているので、
  //   画面側（MemberCircles.tsx）で聞いています。
  const [userId, { data: communities }] = await Promise.all([
    getCurrentUserId(supabase),
    // 並び順を決めておかないと、DB の都合で順番が変わることがあり、
    // ?c= 無しで開いたときの「一番上」が、開くたびに違うコミュニティになっていました。
    // 作った順（古い順）に固定します
    supabase
      .from("communities")
      .select("id, name, icon_url")
      .order("created_at", { ascending: true }),
  ]);

  // 画面側は user.id だけを使うので、その形にそろえて返します
  const user = userId === null ? null : { id: userId };

  if (user === null) {
    return {
      user: null,
      communities: [],
      members: [],
      currentId: null,
      recoveryRequests: [],
      todayCount: 0,
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
      todayCount: 0,
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
  const [
    { data: memberships },
    { data: recentPosts },
    { data: recoveries },
    { data: lastContacts },
  ] =
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
        .select("author_id, created_at")
        .in("community_id", targetIds)
        .order("created_at", { ascending: false })
        .limit(20),

      // 待ち中の復旧申請。コミュニティ全員に見せて、誰でも止められるようにします
      supabase
        .from("recovery_requests")
        .select("id, target_user, requested_at")
        .eq("community_id", currentId)
        .eq("status", "pending"),

      // 相手ごとの「最後にやりとりした日時」（supabase/01_schema.sql の last_contacts）。
      // 自分の分だけを取ります
      supabase
        .from("last_contacts")
        .select("partner, last_at")
        .eq("me", user.id),
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

  // ▼ 光らせるのは「まだ見ていない新しいご報告がある人」だけです（lib/seenPosts.ts）。
  //   その人の最新のご報告の日時と、見たところまでの日時を比べます。
  //   recentPosts は新しい順なので、その人が最初に出てきた行が最新です。
  const seen = parseSeen((await cookies()).get(SEEN_COOKIE)?.value);
  const hasUnseen = (authorId: string) => {
    const latest = recentPosts?.find((post) => post.author_id === authorId);
    if (!latest) return false;
    const seenAt = seen[authorId];
    return seenAt === undefined || new Date(latest.created_at) > new Date(seenAt);
  };

  // ▼ 「今日 N件の報告」を出すための数です。
  //   上で取ってきた新しい投稿20件を、そのまま数え直しているだけなので、
  //   データベースへの問い合わせは増えていません。
  //
  //   toLocaleDateString は「2026/9/22」のような、時刻の入らない日付の文字を返します。
  //   これが同じなら同じ日、と分かります。
  //
  //   timeZone: "Asia/Tokyo" を必ず付けます。
  //   この処理はサーバー（Vercel）で動き、サーバーの時計は日本ではなく世界標準時です。
  //   付けないと、日本時間の朝9時まで「今日」が前の日のままになっていました。
  const toJapanDate = (date: Date) =>
    date.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
  const today = toJapanDate(new Date());
  const todayCount =
    recentPosts?.filter(
      (post) => toJapanDate(new Date(post.created_at)) === today,
    ).length ?? 0;

  // その人と最後にやりとりした日時。無ければ null
  const findLastContact = (partnerId: string) =>
    lastContacts?.find((contact) => contact.partner === partnerId)?.last_at ?? null;

  const members: Member[] =
    profiles?.map((profile) => ({
      id: profile.id,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      hasNews: hasUnseen(profile.id),
      birthday: profile.birthday,
      mood: profile.mood,
      lastContactLabel: formatLastContact(findLastContact(profile.id)),
      lastContactYears: yearsSince(findLastContact(profile.id)),
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

  return {
    user,
    communities: list,
    members,
    currentId,
    recoveryRequests,
    todayCount,
  };
}
