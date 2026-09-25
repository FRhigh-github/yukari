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
        {/* ▼ 白い台紙に金のふち。
              前は上のほうに水引の帯と結び目をかけていましたが、
              送ったカードの文字や写真が隠れてしまうので、無くしました。
              aspect-[2/3] = 縦横の比。はがきの形にそろえます */}
        <div className="rounded-xl bg-white p-1.5 ring-1 ring-kin/60">
          <div className="aspect-[2/3] w-full overflow-hidden rounded-lg">
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
        </div>

        <p className="mt-2 truncate text-sm font-bold text-stone-800">
          {partnerName ?? "名無し"} <span className="font-normal text-kin">{suffix}</span>
        </p>
        <p className="text-xs text-stone-400">
          {/* timeZone = サーバーで描いても日本の日付にするため（サーバーの時計は世界標準時） */}
          {new Date(sentAt).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
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
            className="max-h-[75vh] w-auto rounded-xl bg-white p-2 shadow-2xl ring-1 ring-kin"
          />
          <p className="text-xs text-white/70">
            {partnerName ?? "名無し"} {suffix}
          </p>
        </div>
      ) : null}
    </>
  );
}
