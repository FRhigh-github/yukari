// ログアウトのボタンです。自分のプロフィール画面のいちばん下に置きます。
//
// ▼ なぜ要るのか
//   前はログアウトの手段がどこにも無く、1台のスマホを何人かで回して見るときに、
//   前の人のアカウントのまま使うしかありませんでした。
//   （ログイン済みでログイン画面を開くとホームへ戻す作り（proxy.ts）なので、なおさら必要です）

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleLogout = async () => {
    setIsSending(true);
    // signOut = ブラウザに保存したログインの証明書（Cookie）を消す命令
    await createClient().auth.signOut();
    // Link ではなく、ブラウザごと読み込み直してログイン画面へ行きます。
    // 前の人の画面の記憶（先読みした中身）を残さないためです
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- わざと読み込み直すため
    window.location.assign("/login");
  };

  // 押し間違いで出てしまわないよう、1回目は確認に変わるだけにします
  if (isConfirming) {
    return (
      <div className="space-y-2">
        <p className="text-center text-sm text-stone-600">ログアウトしますか？</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isSending}
            className="h-11 flex-1 cursor-pointer rounded-xl bg-beni text-sm font-bold text-white disabled:opacity-50"
          >
            {isSending ? "ログアウト中…" : "ログアウトする"}
          </button>
          <button
            type="button"
            onClick={() => setIsConfirming(false)}
            disabled={isSending}
            className="h-11 flex-1 cursor-pointer rounded-xl border border-stone-300 bg-white text-sm text-stone-600"
          >
            やめる
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsConfirming(true)}
      className="h-11 w-full cursor-pointer rounded-xl border border-stone-300 bg-white text-sm text-stone-600"
    >
      ログアウト
    </button>
  );
}
