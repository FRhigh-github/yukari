// カードの見た目を CSS だけで描く部品です。
// 画像を用意していないので、種類ごとに色と絵文字を変えて
// それらしく見せています。本物の絵に差し替えるのは後からできます。

export type CardKind = "newyear" | "summer" | "birthday" | "custom";

export const CARD_KINDS: { kind: CardKind; label: string }[] = [
  { kind: "summer", label: "暑中見舞い" },
  { kind: "newyear", label: "年賀状" },
  { kind: "birthday", label: "バースデーカード" },
  { kind: "custom", label: "その他" },
];

// 種類ごとの色づかいと飾り。
const STYLES: Record<
  CardKind,
  { background: string; text: string; emoji: string }
> = {
  newyear: {
    background: "linear-gradient(160deg, #fdf3e7 0%, #f6d9c4 55%, #e8a87c 100%)",
    text: "#8c2f2f",
    emoji: "🎍",
  },
  summer: {
    background: "linear-gradient(160deg, #eef8fb 0%, #c9e8f2 55%, #9fd3e3 100%)",
    text: "#1f5d73",
    emoji: "🎐",
  },
  birthday: {
    background: "linear-gradient(160deg, #fff4f8 0%, #fbd7e6 55%, #f6c2d4 100%)",
    text: "#a03a67",
    emoji: "🎂",
  },
  custom: {
    background: "linear-gradient(160deg, #faf7f0 0%, #efe9dc 100%)",
    text: "#6b6257",
    emoji: "✉️",
  },
};

type CardTemplateProps = {
  kind: CardKind;
  name: string;
  // 一覧では小さく、送る画面では大きく出したいので、大きさは外から渡します
  className?: string;
};

export default function CardTemplate({
  kind,
  name,
  className = "",
}: CardTemplateProps) {
  const style = STYLES[kind];

  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-xl ${className}`}
      style={{ background: style.background, color: style.text }}
    >
      <span className="text-3xl">{style.emoji}</span>
      <span className="px-2 text-center text-xs font-bold leading-tight">
        {name}
      </span>
    </div>
  );
}
