import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PostCard from "@/components/PostCard";

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
  const findImageUrl = (path: string | null) =>
    signedUrls?.find((item) => item.path === path)?.signedUrl ?? null;

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
          />
        ))
      )}
    </main>
  );
}
