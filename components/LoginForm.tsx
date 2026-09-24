// ログイン画面です。
//
// 入り方は3つ。
//   ・メールとパスワード
//   ・Google
//   ・思い出ログイン（メールもGoogleも失った人が、仲間の力で戻る道）

"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import GoogleButton from "@/components/GoogleButton";
import PasswordField from "@/components/PasswordField";
import KnotMark from "@/components/KnotMark";

type LoginFormProps = {
  // Googleから戻ってきて失敗したときの理由。うまくいっていれば null。
  initialMessage: string | null;
  // 発表用の「デモで入る」ボタンを出すか（環境変数 DEMO_COMMUNITY_ID があるときだけ true）
  demoEnabled: boolean;
};

export default function LoginForm({ initialMessage, demoEnabled }: LoginFormProps) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(initialMessage);

  // ▼ 「デモで入る」。サーバーが、押した人専用の使い捨てアカウントを作って、
  //   デモ用のコミュニティに入れた状態でログインさせてくれます（app/api/demo-login）。
  //   発表で、登録の手間をとばしてすぐ中身を見せるためのものです
  const handleDemo = async () => {
    setMessage(null);
    setIsSending(true);
    // 通信が切れていると fetch そのものが失敗します（例外）。
    // 受け止めないと、ボタンが押せないまま戻らなくなっていました
    try {
      const response = await fetch("/api/demo-login", { method: "POST" });
      if (!response.ok) {
        // サーバーが返した理由（「デモの準備ができていません」など）を、そのまま出します
        const result = await response.json().catch(() => null);
        setMessage(result?.error ?? "デモに入れませんでした");
        setIsSending(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setMessage("つながりませんでした。電波の良いところで、もう一度お試しください");
      setIsSending(false);
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsSending(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // 「メールが違う」「パスワードが違う」を区別して出しません。
      // どちらか分かると、登録済みのメールを探られる手がかりになります。
      setMessage("メールアドレスかパスワードが違います");
      setIsSending(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <main className="flex h-full flex-col justify-center gap-5 p-8">
      <KnotMark />

      <form onSubmit={handleLogin} className="space-y-3">
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
          <PasswordField value={password} onChange={setPassword} />
        </Field>

        <button
          type="submit"
          disabled={isSending}
          className="w-full cursor-pointer rounded-full bg-beni py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          {isSending ? "確認中..." : "ログイン"}
        </button>
      </form>

      {message ? <p className="text-xs text-beni">{message}</p> : null}

      {/* ▼ 発表用。押すだけで、投稿やメンバーがそろったデモ用アカウントに入れます */}
      {demoEnabled ? (
        <button
          type="button"
          onClick={handleDemo}
          disabled={isSending}
          className="h-14 w-full cursor-pointer rounded-full bg-white text-base font-bold text-beni ring-2 ring-beni disabled:opacity-40"
        >
          デモで入る
        </button>
      ) : null}

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-stone-200" />
        <span className="text-xs text-stone-400">または</span>
        <span className="h-px flex-1 bg-stone-200" />
      </div>

      <GoogleButton label="Googleでログイン" from="login" />

      {/* ▼ はじめての人の入口。
          文字のリンクだと、ログインの欄に埋もれて気づかれません。
          枠で囲って、ログインと同じ大きさの入口にします。 */}
      <Link
        href="/signup"
        className="block rounded-full border-2 border-kin py-3 text-center text-sm font-bold text-kin"
      >
        はじめての方はこちら
      </Link>

      <Link
        href="/recover"
        className="text-center text-xs text-stone-500 underline"
      >
        メールもパスワードも分からない（思い出ログイン）
      </Link>
    </main>
  );
}

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
