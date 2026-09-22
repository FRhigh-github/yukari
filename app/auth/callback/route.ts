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

  // 交換に失敗したときの理由を、あとで画面に出すために控えておきます
  let exchangeError: string | null = null

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

      // ▼ 初めての人には、そのことを伝えます。
      //
      //   Googleは「初めてか、2回目か」を区別してくれません。
      //   押した時点でアカウントが作られてしまうので、
      //   「ログインしたつもりが、新しく作られていた」ことが起こります。
      //   気づかないまま進むと、前のアカウントの中身が見えずに戸惑います。
      if (!profile?.birthday) {
        // ログイン画面から押した人にだけ知らせます。
        // サインアップ画面から押した人は、作るつもりで押しているので不要です。
        const isFromLogin = searchParams.get('from') === 'login'

        return NextResponse.redirect(
          `${origin}/setup${isFromLogin ? '?new=1' : ''}`,
        )
      }

      return NextResponse.redirect(`${origin}/`)
    }

    exchangeError = error.message
  }

  // ▼ ここへ来るのは、うまくいかなかったときです。
  //
  //   Google 側で断られた場合、?error=... と ?error_description=... が付いてきます。
  //   何も出さずにログイン画面へ戻すと「押したのに戻された」としか分からないので、
  //   理由をそのまま持って帰って、画面に出します。
  const reason =
    searchParams.get('error_description') ??
    searchParams.get('error') ??
    exchangeError ??
    'Googleから返事がありませんでした'

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(reason)}`,
  )
}