// ログインまわりのエラーを、日本語に直すところです。
//
// Supabase は英語で返してきます（"User already registered" など）。
// そのまま出すと、何をすればいいのか分かりません。
// ここに1か所まとめておけば、どの画面でも同じ言い方になります。

const MESSAGES: { match: string; text: string }[] = [
  {
    match: "User already registered",
    text: "このメールアドレスは登録済みです。ログインしてください。",
  },
  {
    match: "Invalid login credentials",
    text: "メールアドレスかパスワードが違います",
  },
  {
    match: "Password should be at least",
    text: "パスワードは6文字以上にしてください",
  },
  {
    match: "Unable to validate email address",
    text: "メールアドレスの形を確認してください",
  },
  {
    match: "Email not confirmed",
    text: "メールのリンクを開いてから、ログインしてください",
  },
  {
    match: "For security purposes",
    text: "少し時間をおいてから、もう一度お試しください",
  },
  {
    match: "Email rate limit exceeded",
    text: "送信が続いたため、しばらく待つ必要があります",
  },
  {
    match: "code verifier",
    text: "ログインの途中で場所が変わったようです。もう一度お試しください。",
  },
];

export function toJapanese(message: string): string {
  // includes = その文字が含まれているか。
  // Supabase は同じ意味でも文末が変わることがあるので、
  // 完全一致ではなく「含まれているか」で見ています。
  const found = MESSAGES.find((item) => message.includes(item.match));

  // 知らないエラーは、そのまま出します。
  // 適当に「失敗しました」とまとめると、原因が追えなくなるためです。
  return found?.text ?? message;
}
