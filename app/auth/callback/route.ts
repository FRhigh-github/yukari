import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ユーザーがGoogleでログインを許可すると、Googleはこの住所に戻してくる。
// そのとき ?code=xxxxx という引数が付いてくる。
// この code を「本物のログイン情報」に交換するのがこのファイルの仕事。
export async function GET(request: Request) {
  // 戻ってきたURLを分解する
  // searchParams = ?以降の部分 / origin = http://localhost:3000 の部分
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()

    // code を渡して、ログイン情報（セッション）に交換してもらう。
    // 成功すると、Cookieにログイン状態が保存される。
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    // 問題なければトップページへ送る
    if (!error) return NextResponse.redirect(`${origin}/`)
  }

  // code がない、または交換に失敗した場合はログイン画面へ戻す
  return NextResponse.redirect(`${origin}/login?error=1`)
}