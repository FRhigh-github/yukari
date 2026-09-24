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
import LogoutButton from "@/components/LogoutButton";
import { getSignedUrls } from "@/lib/signedUrls";
// バージョンの番号は package.json の1か所だけで管理します（CHANGELOG.md も合わせて書く）。
// この画面はサーバーで作るので、package.json がブラウザに配られることはありません
import packageJson from "@/package.json";

export default async function ProfilePage() {
  const supabase = await createClient();

  // 1回目：本人確認と、入っているコミュニティを同時に取ります
  // 本人確認は通信なしで済みます（lib/supabase/server.ts の getCurrentUserId）
  const [userId, { data: communities }] = await Promise.all([
    getCurrentUserId(supabase),
    supabase.from("communities").select("name").order("created_at", { ascending: true }),
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
      .select("id, title, image_url, created_at")
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

      {/* 小さい「ご報告のはがき」を2列に並べます。押すと、そのご報告を大きく開きます */}
      <PostGrid
        memberId={user.id}
        posts={
          posts?.map((post) => ({
            id: post.id,
            title: post.title,
            imageUrl: findImageUrl(post.image_url),
            createdAt: post.created_at,
          })) ?? []
        }
      />

      {/* ログアウト。いちばん下の、押し間違えにくい場所に置きます */}
      <div className="px-4 pt-10">
        <LogoutButton />
      </div>

      {/* アプリのバージョン。何の版を見ているか、発表や不具合の相談のときに分かるようにします */}
      <p className="pt-6 text-center text-xs tracking-widest text-stone-400">
        ゆかり v{packageJson.version}
      </p>
    </main>
  );
}
