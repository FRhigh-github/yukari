"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type InviteCodeProps = {
  code: string;
  communityName: string;
  communityId: string;
  // 作成者か。作成者にだけ「作り直す」を出します（DB でも作成者だけに絞っています）
  canRegenerate: boolean;
};

export default function InviteCode({
  code,
  communityName,
  communityId,
  canRegenerate,
}: InviteCodeProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // ▼ 招待コードを作り直します（supabase/01_schema.sql の regenerate_invite_code）。
  //   コードが知らない人に広まってしまったときのためです。前のコードは使えなくなります
  const handleRegenerate = async () => {
    const { data, error } = await createClient().rpc("regenerate_invite_code", {
      target_community: communityId,
    });
    setIsConfirming(false);
    if (error || typeof data !== "string") {
      console.error("招待コードを作り直せませんでした", error);
      setMessage("作り直せませんでした。もう一度お試しください");
      return;
    }
    setMessage("新しいコードにしました");
    router.refresh();
  };

  const text = `「${communityName}」に参加しませんか？\n招待コード: ${code}`;

  const handleShare = async () => {
    // navigator.share = スマホの共有メニュー（LINEやメールに直接送れるもの）。
    // PC では用意されていないことが多いので、その場合はコピーに切り替えます。
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }

      await navigator.clipboard.writeText(text);
      setMessage("コピーしました");
    } catch {
      // 共有をやめたときもここに来ます。何も出さずに終わります。
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setMessage("コードをコピーしました");
    } catch {
      // コピーできなくても、コードは画面に出ているので手で写せます
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleCopyCode}
        className="flex w-full items-center justify-between rounded-xl border border-kin/50 bg-white px-4 py-3"
      >
        {/* tracking-widest = 文字の間を広げて読みやすくします */}
        <span className="font-mono text-lg tracking-widest text-stone-800">
          {code}
        </span>
        <span className="text-xs text-kin">コピー</span>
      </button>

      <button
        type="button"
        onClick={handleShare}
        className="h-12 w-full rounded-xl bg-beni text-sm font-bold text-white"
      >
        招待を送る
      </button>

      {canRegenerate ? (
        isConfirming ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRegenerate}
              className="h-11 flex-1 rounded-xl border border-beni bg-white text-sm font-bold text-beni"
            >
              作り直す（前のコードは使えなくなります）
            </button>
            <button
              type="button"
              onClick={() => setIsConfirming(false)}
              className="h-11 rounded-xl px-3 text-sm text-stone-500"
            >
              やめる
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsConfirming(true)}
            className="h-11 w-full text-sm text-stone-500 underline"
          >
            コードを作り直す
          </button>
        )
      ) : null}

      {message ? (
        <p className="text-center text-xs text-stone-500">{message}</p>
      ) : null}
    </div>
  );
}
