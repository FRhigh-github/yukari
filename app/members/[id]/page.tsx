import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PostCard from "@/components/PostCard";
import type { Reaction } from "@/components/ReactionBoard";

// [id] という名前のフォルダにすると、URL の一部を受け取れます。
// 例: /members/abc123 → id は "abc123"
export default async function MemberPage({
  params,
}: PageProps<"/members/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  // single() = 1件だけ取ってくる（配列ではなく、そのものが返ります）
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", id)
    .single();

  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .eq("author_id", id)
    .order("created_at", { ascending: false });

  // posts に入っているのは「保管庫のどこに置いたか」という場所だけです。
  // 保管庫は非公開なので、見るには期限付きの URL を発行してもらいます（3600秒＝1時間）。
  const imagePaths =
    posts?.filter((post) => post.image_url).map((post) => post.image_url) ?? [];

  const { data: signedUrls } =
    imagePaths.length > 0
      ? await supabase.storage.from("posts").createSignedUrls(imagePaths, 3600)
      : { data: null };

  // 置き場所から URL を探す。find() = 条件に合う最初の1件を返す
  const findImageUrl = (path: string | null) => {
    if (!path) return null;
    // デバッグ用データは最初から URL なので、そのまま使います
    if (path.startsWith("http")) return path;
    return signedUrls?.find((item) => item.path === path)?.signedUrl ?? null;
  };

  // ▼ この人の報告に届いた、手書きのお祝い
  const postIds = posts?.map((post) => post.id) ?? [];

  const { data: reactions } = await supabase
    .from("post_reactions")
    .select("id, post_id, from_user, drawing_url")
    .in("post_id", postIds)
    .order("created_at", { ascending: false });

  // 描いた人の名前を引くために、profiles をまとめて取ります
  const reactionUserIds = Array.from(
    new Set(reactions?.map((reaction) => reaction.from_user) ?? []),
  );

  const { data: reactionUsers } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", reactionUserIds);

  // 手書きは drawings という別の保管庫に入っているので、こちらも URL を発行します
  const drawingPaths = reactions?.map((reaction) => reaction.drawing_url) ?? [];

  const { data: drawingUrls } =
    drawingPaths.length > 0
      ? await supabase.storage.from("drawings").createSignedUrls(drawingPaths, 3600)
      : { data: null };

  // 報告1件ぶんの反応を、表示に使う形にして返します
  const getReactions = (postId: string): Reaction[] =>
    reactions
      ?.filter((reaction) => reaction.post_id === postId)
      .map((reaction) => ({
        id: reaction.id,
        imageUrl:
          drawingUrls?.find((item) => item.path === reaction.drawing_url)
            ?.signedUrl ?? null,
        authorName:
          reactionUsers?.find((user) => user.id === reaction.from_user)
            ?.display_name ?? null,
      })) ?? [];

  return (
    <main className="p-6">
      <Link href="/" className="text-sm text-stone-500">
        ← 戻る
      </Link>

      <h1 className="mb-4 mt-2 text-xl font-bold text-stone-800">
        {profile?.display_name ?? "名無し"} さんのご報告
      </h1>

      {posts?.length === 0 ? (
        <p className="text-sm text-stone-500">まだご報告はありません。</p>
      ) : (
        posts?.map((post) => (
          <PostCard
            key={post.id}
            id={post.id}
            title={post.title}
            body={post.body}
            createdAt={post.created_at}
            imageUrl={findImageUrl(post.image_url)}
            reactions={getReactions(post.id)}
          />
        ))
      )}
    </main>
  );
}
