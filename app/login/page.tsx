// 'use client' = このファイルはブラウザ側で動く、という宣言。
// ボタンのクリックを受け取るには、この宣言が必要。
'use client'

import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  // ボタンが押されたときに実行される処理
  const handleLogin = async () => {
    const supabase = createClient()

    // Googleのログイン画面に飛ばす。
    // redirectTo = 認証が終わった後に戻ってくる住所。
    // ここで ③ で作ったファイルを指定している。
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  return (
    // className の中身は Tailwind の書き方。
    // flex = 並べる / min-h-screen = 画面の高さいっぱい
    // items-center, justify-center = 縦横まんなか / gap-6 = 間隔
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-2xl">ゆかり</h1>

      {/* onClick に関数を渡すと、押されたときに実行される */}
      <button
        onClick={handleLogin}
        className="rounded-full border px-6 py-3"
      >
        Googleでログイン
      </button>
    </main>
  )
}