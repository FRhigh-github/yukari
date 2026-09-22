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
};

export default function GoogleButton({ label }: GoogleButtonProps) {
  const handleClick = async () => {
    const supabase = createClient();

    // redirectTo = 認証が終わったあとに戻ってくる住所
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full cursor-pointer rounded-full border border-stone-300 py-3 text-sm font-bold text-stone-700"
    >
      {label}
    </button>
  );
}
