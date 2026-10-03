// 新しいパスワードを決める画面です。ログインしている人だけが開けます（proxy.ts）。
//
// 次の3つの道から来ます。
//   ・パスワードを忘れた人が、再設定のメールのリンクを押した（/forgot → /auth/callback）
//   ・思い出ログインで戻ってきた人（/recover）。メールもパスワードも無いので、ここで決め直します
//   ・プロフィールの編集から、パスワードを変えたい人

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PasswordField from "@/components/PasswordField";
import KnotMark from "@/components/KnotMark";
import { toJapanese } from "@/lib/authMessage";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSending(true);
    setMessage(null);

    // updateUser = ログインしている本人の情報を書き換える命令。ここではパスワードだけを変えます
    const { error } = await createClient().auth.updateUser({ password });

    if (error) {
      // Supabase は英語で返してくるので、日本語に直して出します（lib/authMessage.ts）
      setMessage(toJapanese(error.message));
      setIsSending(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <main className="flex h-full flex-col justify-center gap-5 p-8">
      <KnotMark />

      <h1 className="text-center text-xl font-bold text-stone-800">新しいパスワード</h1>

      <form onSubmit={handleSave} className="space-y-3">
        <label className="block">
          <span className="text-xs text-stone-500">パスワード</span>
          <div className="border-b border-stone-200 py-1.5">
            <PasswordField
              value={password}
              onChange={setPassword}
              placeholder="8文字以上"
              minLength={8}
            />
          </div>
        </label>

        <button
          type="submit"
          disabled={isSending}
          className="w-full cursor-pointer rounded-full bg-beni py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          {isSending ? "保存しています…" : "このパスワードにする"}
        </button>
      </form>

      {message ? <p className="text-xs text-beni">{message}</p> : null}
    </main>
  );
}
