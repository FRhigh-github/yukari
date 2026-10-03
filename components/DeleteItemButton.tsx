// 送ったカード・書いた手紙を消すボタンです（app/api/items/delete）。
// 消したものは元に戻せないので、1回目は確認に変わるだけにします。

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DeleteItemButtonProps = {
  kind: "card" | "letter";
  id: string;
  // 消したあとに移る画面。無ければ、今の画面を取り直します
  afterHref?: string;
};

export default function DeleteItemButton({ kind, id, afterHref }: DeleteItemButtonProps) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const label = kind === "card" ? "このカードを消す" : "この手紙を消す";

  const handleDelete = async () => {
    setIsSending(true);
    setMessage(null);
    const response = await fetch("/api/items/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id }),
    }).catch(() => null);
    setIsSending(false);
    if (!response?.ok) {
      setMessage("消せませんでした。もう一度お試しください");
      return;
    }
    if (afterHref) router.push(afterHref);
    router.refresh();
  };

  return (
    // 外側の「押すと閉じる」などに伝えないよう、押した合図をここで止めます
    <div onClick={(event) => event.stopPropagation()} className="flex flex-col items-center gap-1">
      {isConfirming ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSending}
            className="h-11 rounded-xl bg-beni px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {isSending ? "消しています…" : "消す"}
          </button>
          <button
            type="button"
            onClick={() => setIsConfirming(false)}
            className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-600"
          >
            やめる
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsConfirming(true)}
          className="h-11 px-3 text-sm text-stone-400 underline"
        >
          {label}
        </button>
      )}
      {message ? <p className="text-sm text-beni">{message}</p> : null}
    </div>
  );
}
