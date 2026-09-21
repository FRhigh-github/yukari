"use client";

import { useState } from "react";

type InviteCodeProps = {
  code: string;
};

export default function InviteCode({ code }: InviteCodeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    // navigator.clipboard = ブラウザのコピー機能。
    // 使えない環境もあるので、失敗しても止まらないようにしています。
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // コピーできなくても、コードは画面に出ているので手で写せます
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex w-full items-center justify-between rounded-xl bg-stone-100 px-4 py-3"
    >
      {/* tracking-widest = 文字の間を広げて読みやすくします */}
      <span className="font-mono text-lg tracking-widest text-stone-800">
        {code}
      </span>
      <span className="text-xs text-stone-500">
        {copied ? "コピーしました" : "コピー"}
      </span>
    </button>
  );
}
