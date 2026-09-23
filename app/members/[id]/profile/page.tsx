// ほかの人のプロフィール画面です。
//
// 自分のプロフィール（/profile）と同じ見た目で、
// 「編集」ボタンだけが無い形になります。
// ホームでアイコンを長押し →「プロフィールを見る」で来ます。

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProfileHeader from "@/components/ProfileHeader";
import RecoveryCodeButton from "@/components/RecoveryCodeButton";
import { getSignedUrls } from "@/lib/signedUrls";

export default async function MemberProfilePage({
  params,
}: PageProps<"/members/[id]/profile">) {
  const { id } = await params;
  const supabase = await createClient();

  // 1回目：この3つは、どれも id だけで取れます
  const [{ data: profile }, { data: memberships }, { data: posts }] =
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

      {/* ▼ 困っている人を助けるための入口。
          ふだんは使わないものなので、目立たせすぎない場所に置きます。 */}
      <div className="p-5">
        <RecoveryCodeButton
          targetUserId={id}
          targetName={profile?.display_name ?? "この人"}
        />
      </div>

      <h2 className="border-y border-stone-200 bg-white px-5 py-3 text-lg font-bold text-stone-800">
        ご報告
      </h2>

      {posts?.length === 0 ? (
        <p className="p-5 text-sm text-stone-500">まだご報告はありません。</p>
      ) : (
        <ul>
          {posts?.map((post) => (
            <li key={post.id} className="border-b border-stone-100">
              <Link
                href={`/members/${id}`}
                className="flex items-center gap-3 p-4"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-stone-700">
                  {post.title}
                </span>

                {findImageUrl(post.image_url) ? (
                  <span
                    className="h-14 w-20 shrink-0 rounded-lg bg-stone-100 bg-cover bg-center"
                    style={{
                      backgroundImage: `url("${findImageUrl(post.image_url)}")`,
                    }}
                  />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
