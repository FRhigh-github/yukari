// "use client" = このファイルはブラウザ側で動く、という宣言。
// ボタンのクリックを受け取るには、これが必要です。
"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const handleLogin = async () => {
    const supabase = createClient();

    // redirectTo = 認証が終わったあとに戻ってくる住所
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-2xl">ゆかり</h1>

      <button onClick={handleLogin} className="rounded-full border px-6 py-3">
        Googleでログイン
      </button>
    </main>
  );
}
