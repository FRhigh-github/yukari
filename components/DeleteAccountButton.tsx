// 退会（アカウントを消す）のボタンです。自分のプロフィール画面の、ログアウトの下に置きます。
//
// 消したものは元に戻せないので、1回目は確認に変わるだけにします（ログアウトと同じ形）。
// 実際に消すのはサーバーです（app/api/account/delete）。

"use client";

import { useState } from "react";

export default function DeleteAccountButton() {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsSending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "delete" }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        setMessage(result?.error ?? "消せませんでした。もう一度お試しください");
        setIsSending(false);
        return;
      }
      // ブラウザごと読み込み直して、ログイン画面へ（前の人の画面の記憶を残さないため）
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- わざと読み込み直すため
      window.location.assign("/login");
    } catch {
      setMessage("つながりませんでした。電波の良いところで、もう一度お試しください");
      setIsSending(false);
    }
  };

  if (isConfirming) {
    return (
      <div className="space-y-2">
        <p className="text-center text-sm leading-relaxed text-stone-600">
          ご報告・お祝い・カード・手紙・写真も
          <br />
          すべて消え、元に戻せません。
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSending}
            className="h-11 flex-1 cursor-pointer rounded-xl bg-beni text-sm font-bold text-white disabled:opacity-50"
          >
            {isSending ? "消しています…" : "アカウントを消す"}
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
        {message ? <p className="text-center text-sm text-beni">{message}</p> : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsConfirming(true)}
      className="h-11 w-full cursor-pointer text-sm text-stone-500 underline"
    >
      アカウントを消す
    </button>
  );
}
