// メールアドレスを変える画面です。ログインしている人だけが開けます（proxy.ts）。
//
// 新しいアドレスに確認のメールが届き、そのリンクを押したときに切り替わります。
// （打ち間違えたアドレスに切り替わって、ログインできなくなるのを防ぐため。Supabase の決まりです）
//
// 思い出ログインで戻ってきた人は、前のメールアドレスを使えなくなっていることが多いので、
// 新しいパスワードを決めたあと、この画面に来ます（/reset-password）。

"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import KnotMark from "@/components/KnotMark";
import { toJapanese } from "@/lib/authMessage";

export default function ChangeEmailPage() {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSending(true);
    setMessage(null);

    // emailRedirectTo = 確認のメールのリンクを押したあとに戻ってくる場所
    const { error } = await createClient().auth.updateUser(
      { email },
      { emailRedirectTo: `${window.location.origin}/auth/callback` },
    );

    if (error) {
      // Supabase は英語で返してくるので、日本語に直して出します（lib/authMessage.ts）
      setMessage(toJapanese(error.message));
      setIsSending(false);
      return;
    }

    setIsSent(true);
    setIsSending(false);
  };

  return (
    <main className="flex h-full flex-col justify-center gap-5 p-8">
      <KnotMark />

      <h1 className="text-center text-xl font-bold text-stone-800">メールアドレスを変える</h1>

      {isSent ? (
        <p className="text-center text-sm leading-relaxed text-stone-600">
          新しいアドレスに確認のメールを送りました。
          <br />
          リンクを押すと切り替わります。
        </p>
      ) : (
        <form onSubmit={handleSave} className="space-y-3">
          <label className="block">
            <span className="text-xs text-stone-500">新しいメールアドレス</span>
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
            {isSending ? "送っています…" : "確認のメールを送る"}
          </button>
        </form>
      )}

      {message ? <p className="text-xs text-beni">{message}</p> : null}

      <Link href="/profile" className="text-center text-xs text-stone-500">
        プロフィールへ戻る
      </Link>
    </main>
  );
}
