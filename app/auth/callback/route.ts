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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // ▼ 初めての人か、すでに使っている人かで行き先を変えます。
      //
      //   Googleは名前とアイコンはくれますが、誕生日はくれません。
      //   なので誕生日が空なら「まだ入力していない人」とみなして、
      //   アカウント情報の入力画面へ送ります。
      const { data: profile } = await supabase
        .from('profiles')
        .select('birthday')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!profile?.birthday) return NextResponse.redirect(`${origin}/setup`)

      return NextResponse.redirect(`${origin}/`)
    }
  }

  // code がない、または交換に失敗した場合はログイン画面へ戻す
  return NextResponse.redirect(`${origin}/login?error=1`)
}