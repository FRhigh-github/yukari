// 背景をえらぶ画面の中身です。
//
// 種類の絞り込みを、URL（?kind=）ではなくブラウザの中で持っています。
// URLに持たせると、押すたびにサーバーへ作り直してもらうことになり、
// そのぶん待ちが出るためです。ここで持てば、押した瞬間に切り替わります。

"use client";

import Link from "next/link";
import { useState } from "react";
import CardTemplate, { CARD_KINDS } from "@/components/CardTemplate";
import HorizontalScroller from "@/components/HorizontalScroller";

export default function CardBackgroundPicker() {
  // null = 「全て」
  const [kind, setKind] = useState<string | null>(null);

  const shown =
    kind === null ? CARD_KINDS : CARD_KINDS.filter((item) => item.kind === kind);

  return (
    <>
      {/* 種類の絞り込み。左右のボタンで送れます */}
      <HorizontalScroller className="mb-4">
        <KindChip
          label="全て"
          isActive={kind === null}
          onClick={() => setKind(null)}
        />
        {CARD_KINDS.map((item) => (
          <KindChip
            key={item.kind}
            label={item.label}
            isActive={kind === item.kind}
            onClick={() => setKind(item.kind)}
          />
        ))}
      </HorizontalScroller>

      {/* 大きさは全部そろえます。
          aspect-[2/3] = 縦横の比。実際のカードと同じ形です。 */}
      <div className="grid grid-cols-2 gap-3 pb-6">
        {shown.map((item) => (
          <Link
            key={item.kind}
            href={`/cards/new?background=${item.kind}`}
            className="block"
          >
            <CardTemplate
              kind={item.kind}
              name={item.label}
              className="aspect-[2/3] w-full"
            />
          </Link>
        ))}
      </div>
    </>
  );
}

type KindChipProps = {
  label: string;
  isActive: boolean;
  onClick: () => void;
};

function KindChip({ label, isActive, onClick }: KindChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 cursor-pointer rounded-full px-4 py-2 text-xs ${
        isActive ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-600"
      }`}
    >
      {label}
    </button>
  );
}
