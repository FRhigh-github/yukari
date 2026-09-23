// 自分のプロフィール画面です。
//
// 出すもの
//   ・アイコン（気持ちを選んでいれば、その印を右下に重ねます）
//   ・入っているコミュニティの名前
//   ・名前と誕生日
//   ・自分のご報告の一覧

import Link from "next/link";
import PostGrid from "@/components/PostGrid";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import ProfileHeader from "@/components/ProfileHeader";
import { getSignedUrls } from "@/lib/signedUrls";

export default async function ProfilePage() {
  const supabase = await createClient();

  // 1回目：本人確認と、入っているコミュニティを同時に取ります
  // 本人確認は通信なしで済みます（lib/supabase/server.ts の getCurrentUserId）
  const [userId, { data: communities }] = await Promise.all([
    getCurrentUserId(supabase),
    supabase.from("communities").select("name"),
  ]);

  const user = userId === null ? null : { id: userId };

  if (user === null) {
    return (
      <main className="p-6">
        <p className="text-sm text-stone-500">ログインしてください。</p>
        <Link href="/login" className="text-sm text-stone-800 underline">
          ログインへ
        </Link>
      </main>
    );
  }

  // 2回目：自分の情報と、自分のご報告を同時に取ります
  const [{ data: profile }, { data: posts }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url, birthday, mood")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("posts")
      .select("id, title, image_url")
      .eq("author_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

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

  return (
    <main className="pb-24">
      <ProfileHeader
        displayName={profile?.display_name ?? null}
        avatarUrl={profile?.avatar_url ?? null}
        birthday={profile?.birthday ?? null}
        mood={profile?.mood ?? null}
        communityNames={communities?.map((community) => community.name) ?? []}
        isMe
      />

      {/* ▼ 下半分：自分のご報告 */}
      <h2 className="border-y border-stone-200 bg-white px-5 py-3 text-lg font-bold text-stone-800">
        ご報告
      </h2>

      {/* 縦長の写真を3列に並べます（ご報告の一覧と同じ見た目）。押すとストーリーで開きます */}
      <PostGrid
        memberId={user.id}
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
