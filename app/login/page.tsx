// ログイン画面です。
//
// 入力の部分は components/LoginForm.tsx にあります。
// こちらは、Googleから戻ってきたときの「理由」を受け取って渡すだけです。
// URL の ?error= を読むには、サーバー側で受け取るのがいちばん簡単です。

import LoginForm from "@/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const { error } = await searchParams;

  return (
    <LoginForm
      initialMessage={typeof error === "string" ? error : null}
      // 発表用の「デモで入る」ボタン。DEMO_COMMUNITY_ID が設定されているときだけ出します（app/api/demo-login）
      demoEnabled={Boolean(process.env.DEMO_COMMUNITY_ID)}
    />
  );
}
