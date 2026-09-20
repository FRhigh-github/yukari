import { createClient } from "@/lib/supabase/server";

// await を使うので async を付ける
export default async function Home() {
  const supabase = await createClient();

  // posts テーブルから全部の列を取ってくる
  // data には「オブジェクトの配列」が入る
  const { data: posts, error } = await supabase
    .from("posts")
    .select("*, profiles(display_name, avatar_url)")
    .order("created_at", { ascending: false });

  // エラーが出たらターミナルに表示する
  if (error) {  
    console.error("取得失敗:", error);
  }

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl">い</h1>

      {/* posts は配列。.map() で1件ずつ並べる */}
      {posts?.map((post) => (
        <article
          key={post.id}
          className="mb-3 rounded-2xl bg-white p-4 shadow-sm"
        >
          {/* 上段: 投稿者と日付 */}
          <div className="mb-2 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-amber-200" />
            <span className="text-sm font-medium text-stone-700">
              {post.profiles?.display_name}
            </span>
            <span className="ml-auto text-xs text-stone-400">
              {new Date(post.created_at).toLocaleDateString("ja-JP")}
            </span>
          </div>

          {/* 本文 */}
          <h2 className="mb-1 font-bold text-stone-800">{post.title}</h2>
          <p className="text-sm leading-relaxed text-stone-600">{post.body}</p>
        </article>
      ))}
    </main>
  );
}
