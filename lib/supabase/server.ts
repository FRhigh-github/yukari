import { createServerClient } from '@supabase/ssr'
// cookies = サーバー側でブラウザのCookieを読み書きするためのNext.jsの機能
import { cookies } from 'next/headers'

// サーバー側（Server Component や route.ts）から使う窓口。
// ログイン状態はCookieに入っているので、それを読める形で作る必要がある。
// Next.js 15 以降は cookies() が非同期なので、この関数も async になる。
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Supabaseに「Cookieはこうやって読み書きしてね」と教えている部分
      cookies: {
        // 今あるCookieを全部渡す（ログイン状態の確認に使われる）
        getAll() {
          return cookieStore.getAll()
        },
        // Supabaseが「このCookieを保存して」と言ってきたときの処理
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component からは Cookie を書き換えられない仕様なので、
            // ここでエラーになる。ただし実害はないので握りつぶしてよい。
            // （書き込みが必要な場面では route.ts 側で処理される）
          }
        },
      },
    }
  )
}

// ▼ ログインしている人の id を返します。ログインしていなければ null。
//
// 前は各画面で auth.getUser() を使っていました。
// getUser() は、毎回 Supabase のサーバーまで「この人は本物？」と聞きに行くので、
// 画面を開くたびに通信1回ぶん（日本からだと 0.1〜0.3秒ほど）待たされていました。
//
// getClaims() は、ログインの証明書（JWT）に付いている署名を、この場で確かめます。
// このプロジェクトの署名は ES256（公開鍵で確かめられる方式）なので、
// 最初に一度だけ公開鍵をもらえば、あとは通信なしで本人確認ができます。
// 偽物の証明書は署名が合わないので、getUser() と同じく安全です。
export async function getCurrentUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims()
  return data?.claims.sub ?? null
}
