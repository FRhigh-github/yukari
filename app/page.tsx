
import { createClient } from '@/lib/supabase/server'

// 関数に async が付いている＝サーバー側で動くコンポーネント。
// ブラウザに届く前に、サーバーでデータを取ってから画面を作れる。
export default async function Home() {
  const supabase = await createClient()

  // 今ログインしている人の情報を取ってくる。
  // ログインしていなければ user は null になる。
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl">ゆかり</h1>

      {/* {条件 ? Aを表示 : Bを表示} という書き方。
          JSXの中でif文の代わりに使う頻出パターン。 */}
      {user ? (
        <p>ログイン中: {user.email}</p>
      ) : (
        <a href="/login" className="underline">ログインする</a>
      )}
    </main>
  )
}