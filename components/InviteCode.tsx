"use client";

import { useState } from "react";

type InviteCodeProps = {
  code: string;
  communityName: string;
};

export default function InviteCode({ code, communityName }: InviteCodeProps) {
  const [message, setMessage] = useState<string | null>(null);

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
        className="flex w-full items-center justify-between rounded-xl bg-stone-100 px-4 py-3"
      >
        {/* tracking-widest = 文字の間を広げて読みやすくします */}
        <span className="font-mono text-lg tracking-widest text-stone-800">
          {code}
        </span>
        <span className="text-xs text-stone-500">コピー</span>
      </button>

      <button
        type="button"
        onClick={handleShare}
        className="w-full rounded-xl bg-stone-800 py-3 text-sm font-bold text-white"
      >
        招待を送る
      </button>

      {message ? (
        <p className="text-center text-xs text-stone-500">{message}</p>
      ) : null}
    </div>
  );
}
