// 届いたカード1枚ぶん。押すと大きく表示します。

"use client";

import { useState } from "react";
import CardTemplate, { type CardKind } from "@/components/CardTemplate";

type ReceivedCardProps = {
  imageUrl: string | null;
  // 届いたときは送り主、送ったときは宛先
  partnerName: string | null;
  // 「さんから」か「さんへ」
  suffix: string;
  sentAt: string;
  // 画像がまだ無い古いカード用の、代わりの見た目
  kind: CardKind;
  backgroundName: string;
};

export default function ReceivedCard({
  imageUrl,
  partnerName,
  suffix,
  sentAt,
  kind,
  backgroundName,
}: ReceivedCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => imageUrl && setIsOpen(true)}
        className="w-full text-left"
      >
        {/* aspect-[2/3] = 縦横の比。はがきの形にそろえます */}
        <div className="aspect-[2/3] w-full overflow-hidden rounded-xl shadow-md">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <CardTemplate
              kind={kind}
              name={backgroundName}
              className="h-full w-full"
            />
          )}
        </div>

        <p className="mt-1.5 truncate text-xs font-bold text-stone-700">
          {partnerName ?? "名無し"} {suffix}
        </p>
        <p className="text-[10px] text-stone-400">
          {new Date(sentAt).toLocaleDateString("ja-JP")}
        </p>
      </button>

      {/* 拡大表示。どこを押しても閉じます */}
      {isOpen && imageUrl ? (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="max-h-[75vh] w-auto rounded-xl shadow-2xl"
          />
          <p className="text-xs text-white/70">
            {partnerName ?? "名無し"} {suffix}
          </p>
        </div>
      ) : null}
    </>
  );
}
