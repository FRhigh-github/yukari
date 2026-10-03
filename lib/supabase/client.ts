// createBrowserClient = ブラウザ上で動くSupabase接続を作る関数
import { createBrowserClient } from '@supabase/ssr'

// この createClient() を呼ぶと、Supabaseと通信できる「窓口」が返ってくる。
// 画面のコンポーネント（'use client' が付いたファイル）から使う。
export function createClient() {
  return createBrowserClient(
    // .env.local に書いた接続情報を読み込んでいる。
    // NEXT_PUBLIC_ で始まる名前にすると、ブラウザ側からも読めるようになる。
    // 末尾の ! は「この値は必ず存在する」とTypeScriptに伝える印。
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
// ▼ ログインしている人の id を返します。ログインしていなければ null。
//   getUser() は毎回 Supabase まで「この人は本物？」と聞きに行きますが、
//   getClaims() は証明書の署名をこの場で確かめるので、通信なしで済みます
//   （サーバー側の getCurrentUserId と同じ考え方。lib/supabase/server.ts）
export async function getMyId(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.auth.getClaims()
  return data?.claims.sub ?? null
}
