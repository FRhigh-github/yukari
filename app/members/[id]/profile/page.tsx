// ほかの人のプロフィール画面です。
//
// 自分のプロフィール（/profile）と同じ見た目で、
// 「編集」ボタンだけが無い形になります。
// ホームでアイコンを長押し →「プロフィールを見る」で来ます。

import Link from "next/link";
import PostGrid from "@/components/PostGrid";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import ProfileHeader from "@/components/ProfileHeader";
import RecoveryCodeButton from "@/components/RecoveryCodeButton";
import { getSignedUrls } from "@/lib/signedUrls";
import { formatLastContact } from "@/lib/lastContact";

export default async function MemberProfilePage({
  params,
}: PageProps<"/members/[id]/profile">) {
  const { id } = await params;
  const supabase = await createClient();

  // 1回目：この5つは、どれも id だけで取れます
  // getCurrentUserId = 自分か確かめるため。通信なしで済みます（lib/supabase/server.ts）
  const [
    { data: profile },
    { data: memberships },
    { data: posts },
    { data: lastContact },
    myId,
  ] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, avatar_url, birthday, mood")
        .eq("id", id)
        .maybeSingle(),

      // その人が入っているコミュニティ。
      // RLS のおかげで、自分も入っているものだけが返ります。
      supabase
        .from("memberships")
        .select("communities(name)")
        .eq("user_id", id),

      supabase
        .from("posts")
        .select("id, title, image_url")
        .eq("author_id", id)
        .order("created_at", { ascending: false })
        .limit(30),

      // この人と最後にやりとりした日時（supabase/01_schema.sql の last_contacts）。
      // me で絞らなくても、RLS で自分が関わった分しか返りませんが、
      // 「自分から見た相手」の1行だけにするため、partner でも絞ります
      supabase
        .from("last_contacts")
        .select("last_at")
        .eq("partner", id)
        .maybeSingle(),

      getCurrentUserId(supabase),
    ]);

  const isMe = myId === id;
  const lastContactLabel = formatLastContact(lastContact?.last_at ?? null);

  // 写真の置き場所から、期限付きのURLを発行してもらいます
  const imagePaths =
    posts
      ?.filter((post) => post.image_url && !post.image_url.startsWith("http"))
      .map((post) => post.image_url) ?? [];

  // URL は lib/signedUrls.ts で作ります（同じ写真には同じURLを返すので、写真を使い回せます）
  const findSignedImage = await getSignedUrls("posts", imagePaths);

  const findImageUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return findSignedImage(path);
  };

  // ▼ 一緒に持ってきた communities から、名前だけを取り出します。
  //
  //   ここは1件ぶんのまとまりで返ることも、並びで返ることもあります。
  //   （結びつきの数え方によって、Supabase側の形が変わるためです）
  //   どちらでも動くように、並びでなければ1件の並びに直してから扱います。
  const communityNames =
    memberships?.flatMap((membership) => {
      const related = membership.communities;
      if (!related) return [];

      const list = Array.isArray(related) ? related : [related];
      return list.map((community) => community.name);
    }) ?? [];

  return (
    <main className="pb-24">
      <div className="px-5 pt-3">
        <Link href="/" className="text-sm text-stone-500">
          ← ホーム
        </Link>
      </div>

      <ProfileHeader
        displayName={profile?.display_name ?? null}
        avatarUrl={profile?.avatar_url ?? null}
        birthday={profile?.birthday ?? null}
        mood={profile?.mood ?? null}
        communityNames={communityNames}
      />

      {/* ▼ 「最後に話したのは何年前」。自分のプロフィールには出しません。
            カード・お祝い・チャットを送ると、DB が自動で記録します */}
      {isMe ? null : (
        <p className="mx-5 mt-4 rounded-xl border border-kin/30 bg-white px-4 py-3 text-center text-sm text-stone-600">
          {lastContactLabel === null ? (
            "まだやりとりはありません"
          ) : (
            <>
              最後にやりとりしたのは{" "}
              <span className="text-base font-bold text-kin">{lastContactLabel}</span>
            </>
          )}
        </p>
      )}

      {/* ▼ 困っている人を助けるための入口。
          ふだんは使わないものなので、目立たせすぎない場所に置きます。
          自分で自分のコードは出せない（DB が止める）ので、自分のプロフィールには出しません */}
      {isMe ? null : (
        <div className="p-5">
          <RecoveryCodeButton
            targetUserId={id}
            targetName={profile?.display_name ?? "この人"}
          />
        </div>
      )}

      <h2 className="border-y border-stone-200 bg-white px-5 py-3 text-lg font-bold text-stone-800">
        ご報告
      </h2>

      {/* 縦長の写真を3列に並べます（ご報告の一覧と同じ見た目）。押すとストーリーで開きます */}
      <PostGrid
        memberId={id}
        posts={
          posts?.map((post) => ({
            id: post.id,
            title: post.title,
            imageUrl: findImageUrl(post.image_url),
          })) ?? []
        }
      />
    </main>
  );
}
