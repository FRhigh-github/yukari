// ログイン画面です。
//
// 入力の部分は components/LoginForm.tsx にあります。
// こちらは、Googleから戻ってきたときの「理由」を受け取って渡すだけです。
// URL の ?error= を読むには、サーバー側で受け取るのがいちばん簡単です。

import LoginForm from "@/components/LoginForm";

// ?error= で受け取ってよい合図と、そのときに出す文です（app/auth/callback/route.ts が付けます）。
// ここに無い合図は無視します。URL に書かれた文を、そのまま画面に出さないためです
const ERROR_MESSAGES: Record<string, string> = {
  google_cancelled: "Google でのログインを取りやめました",
  google_failed: "Google でログインできませんでした。もう一度お試しください",
};

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const { error } = await searchParams;

  return (
    <LoginForm
      // Object.hasOwn = その合図が上の一覧に「自分で書いたもの」としてあるか。
      // ただの ERROR_MESSAGES[error] だと、?error=constructor のような名前で、
      // JavaScript が最初から持っている中身を引いてしまうためです
      initialMessage={
        typeof error === "string" && Object.hasOwn(ERROR_MESSAGES, error)
          ? ERROR_MESSAGES[error]
          : null
      }
      // 発表用の「デモで入る」ボタン。DEMO_COMMUNITY_ID が設定されているときだけ出します（app/api/demo-login）
      demoEnabled={Boolean(process.env.DEMO_COMMUNITY_ID)}
    />
  );
}
