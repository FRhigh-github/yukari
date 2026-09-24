// すべての画面の「入口」で、ログインしているかを確かめる処理です。
//
// ▼ なぜ入口でまとめて確かめるのか
//   前は画面ごとに「ログインしていなければ /login へ」と書いていたので、
//   書き忘れた画面（手紙・チャット・カードなど）は、ログインしていなくても開けてしまいました。
//   proxy.ts は、どの画面を開くときも必ず先に通る場所なので、ここで1回確かめれば漏れがありません。
//   （Next.js 16 では、前の middleware.ts がこの名前に変わりました）
//
// ▼ ついでにやっていること
//   ログインの証明書（Cookie）には期限があります。期限が近いときは、ここで新しいものに取り替えます。
//   画面（Server Component）の中では Cookie を書き換えられないので、入口でやる必要があります。

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoGuest } from "@/lib/demoGuest";

// ログインしていなくても開ける画面。
// ログイン・登録・思い出ログイン（本人はまだログインできない）・デモと、その裏で動く処理だけです
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/recover",
  "/auth/callback",
  "/api/recovery",
  // 発表用の「デモで入る」（DEMO_COMMUNITY_ID が無ければ、中で断ります）
  "/api/demo-login",
];

const isPublic = (path: string) =>
  PUBLIC_PATHS.some((publicPath) => path === publicPath || path.startsWith(`${publicPath}/`));

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Supabase の窓口。Cookie の読み書きを、この入口の request / response につなぎます
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // 証明書を取り替えたときに呼ばれます。
        // この先の画面と、ブラウザの両方に新しい Cookie を渡します
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 本人確認。getClaims は証明書の署名をこの場で確かめるので、通信なしで済みます
  // （lib/supabase/server.ts の getCurrentUserId と同じ考え方です）
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims.sub);

  if (!isLoggedIn && !isPublic(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // ▼ デモのゲストは、ほかのコミュニティを作ったり、参加したりできません。
  //   その画面を開こうとしたら、ホームへ戻します（DB 側でも止めています）
  const path = request.nextUrl.pathname;
  if (
    isDemoGuest(data?.claims.email) &&
    (path === "/communities/new" || path === "/communities/join")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

// ▼ 入口を通すのは「画面とAPI」だけにします。
//   画像や JS・CSS などのファイル（_next/static や、名前に . が付くもの）まで確かめると、
//   ログイン画面の絵や飾りまで読み込めなくなるためです
export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
