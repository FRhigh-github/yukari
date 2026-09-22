// Googleで入るボタンです。
//
// サインアップとログインの両方に置きます。
// Googleにはこの2つの区別がなく、同じ操作で
// 初めてならアカウントが作られ、2回目以降は入るだけになります。
// 文言だけ画面ごとに変えられるようにしてあります。

"use client";

import { createClient } from "@/lib/supabase/client";

type GoogleButtonProps = {
  label: string;
  // どの画面から押したか。
  // ログイン画面から押した人は「入るつもり」だったので、
  // 新しく作られたときに、そのことを知らせる必要があります。
  // サインアップ画面から押した人は、作るつもりで押しているので知らせません。
  from: "login" | "signup";
};

export default function GoogleButton({ label, from }: GoogleButtonProps) {
  const handleClick = async () => {
    const supabase = createClient();

    // redirectTo = 認証が終わったあとに戻ってくる住所
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?from=${from}` },
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-full border border-stone-300 py-3 text-sm font-bold text-stone-700"
    >
      {/* Googleの「G」。4色を4つの図形で描いています。
          文字だけだと何のボタンか分かりにくいので、印を添えます。 */}
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
        />
        <path
          fill="#34A853"
          d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
        />
        <path
          fill="#FBBC05"
          d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
        />
        <path
          fill="#EA4335"
          d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
        />
      </svg>

      {label}
    </button>
  );
}
