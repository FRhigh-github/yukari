// パスワードを忘れた人が、再設定のメールを受け取る画面です。
//
// メールのリンクを押すと、/auth/callback を通ってログインした状態になり、
// 新しいパスワードを決める画面（/reset-password）が開きます。
//
// ▼ 登録されていないメールアドレスでも「送りました」と出します
//   「このアドレスは登録されていません」と出すと、
//   誰がこのアプリを使っているかを、アドレスを入れて調べられてしまうためです

"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import KnotMark from "@/components/KnotMark";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSending(true);
    setMessage(null);

    // redirectTo = メールのリンクを押したあとに戻ってくる場所。
    // next=/reset-password で、ログインのあとに新しいパスワードの画面へ送ってもらいます
    //（Supabase のダッシュボードの Redirect URLs に /auth/callback が入っている必要があります）
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      // 回数の制限など。原因は開発者向けに残し、画面には分かりやすい言葉だけを出します
      console.error("再設定のメールを送れませんでした", error);
      setMessage("送れませんでした。時間をおいて、もう一度お試しください");
      setIsSending(false);
      return;
    }

    setIsSent(true);
    setIsSending(false);
  };

  return (
    <main className="flex h-full flex-col justify-center gap-5 p-8">
      <KnotMark />

      <h1 className="text-center text-xl font-bold text-stone-800">パスワードの再設定</h1>

      {isSent ? (
        <p className="text-center text-sm leading-relaxed text-stone-600">
          メールを送りました。
          <br />
          メールのリンクを、この端末で開いてください。
        </p>
      ) : (
        <form onSubmit={handleSend} className="space-y-3">
          <label className="block">
            <span className="text-xs text-stone-500">メールアドレス</span>
            <div className="border-b border-stone-200 py-1.5">
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full bg-transparent text-sm text-stone-800 focus:outline-none"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={isSending}
            className="w-full cursor-pointer rounded-full bg-beni py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {isSending ? "送っています…" : "再設定のメールを送る"}
          </button>
        </form>
      )}

      {message ? <p className="text-xs text-beni">{message}</p> : null}

      <Link href="/login" className="text-center text-xs text-stone-500">
        ログインへ戻る
      </Link>
    </main>
  );
}
