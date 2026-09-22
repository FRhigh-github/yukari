// 画面にそっと重ねる、一言だけの案内です。
//
// 長い説明は読まれません。押せば消えるので、邪魔にもなりません。
// 初めての人が通る道にだけ置きます。

"use client";

import { useState } from "react";

type HintOverlayProps = {
  text: string;
};

export default function HintOverlay({ text }: HintOverlayProps) {
  const [isShown, setIsShown] = useState(true);

  if (!isShown) return null;

  return (
    <div
      onClick={() => setIsShown(false)}
      // 下に何があるか見えるように、薄くかぶせます
      className="absolute inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/40 p-8"
    >
      <div className="rounded-2xl bg-white px-6 py-5 text-center shadow-xl">
        <p className="text-sm leading-relaxed text-stone-700">{text}</p>
        <p className="mt-3 text-[10px] text-stone-400">画面を押すと閉じます</p>
      </div>
    </div>
  );
}
