// カードの背景を表示する部品です。
// 絵そのものは lib/cardBackground.ts が作っています（書き出しと共通）。

import { cardBackgroundUrl, TEXT_COLORS, type CardKind } from "@/lib/cardBackground";

export type { CardKind };

export const CARD_KINDS: { kind: CardKind; label: string }[] = [
  { kind: "summer", label: "暑中見舞い" },
  { kind: "newyear", label: "年賀状" },
  { kind: "birthday", label: "バースデーカード" },
  { kind: "custom", label: "その他" },
];

type CardTemplateProps = {
  kind: CardKind;
  name: string;
  // 一覧では小さく、作る画面では大きく出したいので、大きさは外から渡します
  className?: string;
  // 背景としてだけ使うとき（上に文字や写真を置くとき）は、名前を出しません
  plain?: boolean;
};

export default function CardTemplate({
  kind,
  name,
  className = "",
  plain = false,
}: CardTemplateProps) {
  return (
    <div
      className={`flex items-end justify-center overflow-hidden rounded-xl ${className}`}
      style={{
        backgroundImage: `url("${cardBackgroundUrl(kind)}")`,
        // cover = はみ出してもいいので、箱いっぱいに広げる
        backgroundSize: "cover",
        backgroundPosition: "center",
        color: TEXT_COLORS[kind],
      }}
    >
      {plain ? null : (
        <span className="w-full truncate bg-white/60 px-2 py-1 text-center text-[10px] font-bold">
          {name}
        </span>
      )}
    </div>
  );
}
