import { createClient } from '@/lib/supabase/server'

// await を使うので async を付ける
export default async function Home() {
  const supabase = await createClient()

  // posts テーブルから全部の列を取ってくる
  // data には「オブジェクトの配列」が入る
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')

  // エラーが出たらターミナルに表示する
  if (error) {
    console.error('取得失敗:', error)
  }

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl">投稿一覧</h1>

      {/* posts は配列。.map() で1件ずつ並べる */}
      {posts?.map((post) => (
        <div key={post.id} className="mb-2 rounded border p-3">
          <p>{post.title}</p>
          <p>{post.body}</p>
        </div>
      ))}
    </main>
  )
}