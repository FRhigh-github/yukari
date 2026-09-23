// アカウントを作る画面です。
//
// ここで決めるのは「入るための鍵」だけです（メールとパスワード、またはGoogle）。
// 名前や誕生日は次の /setup で入力してもらいます。
//
// 分けている理由は Google です。
// Googleは一度外のページに飛ぶので、同じ画面で名前を書いてもらうと消えてしまいます。
// どちらの道も必ず /setup を通る形にすれば、記入漏れが起きません。

"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import GoogleButton from "@/components/GoogleButton";
import PasswordField from "@/components/PasswordField";
import KnotMark from "@/components/KnotMark";
import { toJapanese } from "@/lib/authMessage";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsSending(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      // Supabase は英語で返してくるので、日本語に直して出します
      setMessage(toJapanese(error.message));
      setIsSending(false);
      return;
    }

    // ▼ メールの確認が必要な設定だと、ここではまだログインできていません。
    //   その場合は session が空で返ってきます。
    if (data.session === null) {
      setMessage(
        "確認メールを送りました。メールのリンクを開いてから、ログインしてください。",
      );
      setIsSending(false);
      return;
    }

    router.push("/setup");
    router.refresh();
  };

  return (
    <main className="flex h-full flex-col justify-center gap-5 p-8">
      <KnotMark />

      <h1 className="text-center text-xl font-bold text-stone-800">はじめる</h1>

      <form onSubmit={handleSignup} className="space-y-3">
        <Field label="メールアドレス">
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full bg-transparent text-sm text-stone-800 focus:outline-none"
          />
        </Field>

        <Field label="パスワード">
          <PasswordField
            value={password}
            onChange={setPassword}
            placeholder="6文字以上"
            minLength={6}
          />
        </Field>

        <button
          type="submit"
          disabled={isSending}
          className="w-full cursor-pointer rounded-full bg-beni py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          {isSending ? "登録中..." : "登録する"}
        </button>
      </form>

      {message ? <p className="text-xs text-red-600">{message}</p> : null}

      {/* 線と「または」。左右の線は flex-1 で余白いっぱいに伸ばします */}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-stone-200" />
        <span className="text-xs text-stone-400">または</span>
        <span className="h-px flex-1 bg-stone-200" />
      </div>

      <GoogleButton label="Googleではじめる" from="signup" />

      <Link href="/login" className="text-center text-xs text-stone-500">
        すでにアカウントをお持ちの方
      </Link>
    </main>
  );
}

// 入力欄1つぶん。上に項目名、下に線を引いた入力欄。
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs text-stone-500">{label}</span>
      <div className="border-b border-stone-200 py-1.5">{children}</div>
    </label>
  );
}
