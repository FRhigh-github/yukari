// メールを送る処理です。サーバー側（app/api/）からだけ使います。
//
// ▼ Resend（メール送信のサービス）を使います
//   Supabase の認証が送るメール（確認メールなど）は、決まった文しか送れません。
//   「あなたのアカウントに復旧の申請が出ています」のような知らせを送るには、別の仕組みが要ります。
//   Resend は月3,000通まで無料で、API に1回送るだけで使えます（SDK を入れずに fetch で送ります）。
//
// ▼ 鍵が無いときは送りません
//   環境変数 RESEND_API_KEY と MAIL_FROM（送り主のアドレス）が無ければ、何もせずに false を返します。
//   メールが送れなくても、アプリの中の知らせ（ホームの上の黄色い帯）は出ます。

type Mail = {
  to: string;
  subject: string;
  text: string;
};

// 送れたら true。鍵が無い・失敗したときは false（呼んだ側の処理は止めません）
export async function sendMail({ to, subject, text }: Mail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from) {
    console.warn("RESEND_API_KEY / MAIL_FROM が無いので、メールは送りませんでした");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!response.ok) {
      console.error("メールを送れませんでした", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("メールを送れませんでした", error);
    return false;
  }
}
