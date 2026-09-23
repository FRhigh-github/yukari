// カードの背景の絵を作るところです。
//
// ここで作った1枚の絵を、
//   ・画面のプレビュー（CSSの background-image）
//   ・送るときに書き出す画像（canvas に描く）
// の両方で使います。
//
// 別々に描くと、見たものと送られたものがズレてしまうので、
// 作る場所を1つにまとめています。
//
// 絵は SVG という「文字で書ける画像」で作ります。
// 画像ファイルを用意しなくても、コードだけで模様が描けるためです。

export type CardKind =
  | "newyear"
  | "summer"
  | "birthday"
  | "wedding"
  | "baby"
  | "thanks"
  | "custom";

// はがきと同じ縦横比
export const CARD_WIDTH = 900;
export const CARD_HEIGHT = 1350;

// 文字の色は背景ごとに変えます（薄い背景に薄い文字だと読めないため）
export const TEXT_COLORS: Record<CardKind, string> = {
  newyear: "#8c2f2f",
  summer: "#1f5d73",
  birthday: "#a03a67",
  wedding: "#8a1d22",
  baby: "#4f6b8a",
  thanks: "#7a5a1e",
  custom: "#6b6257",
};

// 同じ数字を並べると規則的すぎるので、決め打ちの散らばりを用意しています。
// 毎回ランダムにすると、開くたびに模様が変わってしまいます。
const SCATTER = [
  [120, 220], [700, 160], [380, 430], [760, 520], [160, 640],
  [520, 760], [820, 880], [240, 980], [620, 1120], [100, 1230],
];

const patterns: Record<CardKind, string> = {
  // 年賀状：朝日と、下に市松模様の帯
  newyear: `
    <circle cx="640" cy="300" r="170" fill="#e8564a" opacity="0.85"/>
    <circle cx="640" cy="300" r="210" fill="#e8564a" opacity="0.18"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7]
      .map((i) =>
        i % 2 === 0
          ? `<rect x="${i * 115}" y="1230" width="115" height="120" fill="#c9762f" opacity="0.35"/>`
          : "",
      )
      .join("")}
    <path d="M0 1180 Q225 1120 450 1180 T900 1180 L900 1350 L0 1350 Z" fill="#d9a05b" opacity="0.25"/>
  `,

  // 暑中見舞い：波と泡
  summer: `
    ${[0, 1, 2]
      .map(
        (i) =>
          `<path d="M0 ${900 + i * 90} Q225 ${840 + i * 90} 450 ${900 + i * 90} T900 ${900 + i * 90} L900 1350 L0 1350 Z" fill="#5bb4d4" opacity="${0.18 + i * 0.12}"/>`,
      )
      .join("")}
    ${SCATTER.slice(0, 6)
      .map(
        ([x, y], i) =>
          `<circle cx="${x}" cy="${y * 0.6}" r="${26 + i * 6}" fill="#ffffff" opacity="0.5"/>`,
      )
      .join("")}
  `,

  // バースデー：紙吹雪と、下に丸いドット
  birthday: `
    ${SCATTER.map(
      ([x, y], i) =>
        `<rect x="${x}" y="${y}" width="34" height="22" rx="4" fill="${
          ["#f2a0c0", "#f7d070", "#a3c9f0", "#c7a6e8"][i % 4]
        }" opacity="0.75" transform="rotate(${(i * 37) % 90} ${x} ${y})"/>`,
    ).join("")}
    ${[0, 1, 2, 3, 4, 5, 6, 7]
      .map(
        (i) =>
          `<circle cx="${60 + i * 115}" cy="1290" r="26" fill="#f2a0c0" opacity="0.5"/>`,
      )
      .join("")}
  `,

  // 結婚祝い：紅白の水引の帯と、金の輪（アプリの水引の色と同じ紅・金）
  wedding: `
    <rect x="0" y="520" width="900" height="16" fill="#b7282e" opacity="0.8"/>
    <rect x="0" y="544" width="900" height="16" fill="#ffffff" opacity="0.95"/>
    <rect x="0" y="568" width="900" height="6" fill="#c2a14d" opacity="0.8"/>
    <circle cx="450" cy="545" r="90" fill="none" stroke="#c2a14d" stroke-width="10" opacity="0.8"/>
    <circle cx="450" cy="545" r="60" fill="none" stroke="#b7282e" stroke-width="10" opacity="0.8"/>
    ${SCATTER.map(
      ([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="#c2a14d" opacity="0.35"/>`,
    ).join("")}
  `,

  // 出産祝い：やわらかい水玉と、ふんわりした雲
  baby: `
    ${SCATTER.map(
      ([x, y], i) =>
        `<circle cx="${x}" cy="${y}" r="${30 + (i % 3) * 14}" fill="${
          ["#bcd7f2", "#f7d7e3", "#fdebb3"][i % 3]
        }" opacity="0.7"/>`,
    ).join("")}
    <path d="M0 1200 Q150 1120 300 1200 T600 1200 T900 1200 L900 1350 L0 1350 Z" fill="#ffffff" opacity="0.8"/>
  `,

  // ありがとう：角に金の四角い枠と、小さな花
  thanks: `
    <rect x="60" y="60" width="780" height="1230" rx="24" fill="none" stroke="#c2a14d" stroke-width="6" opacity="0.7"/>
    <rect x="84" y="84" width="732" height="1182" rx="16" fill="none" stroke="#c2a14d" stroke-width="2" opacity="0.5"/>
    ${[[160, 160], [740, 160], [160, 1190], [740, 1190]]
      .map(([x, y]) =>
        [0, 72, 144, 216, 288]
          .map(
            (a) =>
              `<ellipse cx="${x}" cy="${y - 22}" rx="12" ry="22" fill="#e8a0a8" opacity="0.7" transform="rotate(${a} ${x} ${y})"/>`,
          )
          .join(""),
      )
      .join("")}
  `,

  // その他：便箋のような、薄い横罫線
  custom: `
    ${Array.from({ length: 14 })
      .map(
        (_, i) =>
          `<rect x="90" y="${260 + i * 72}" width="720" height="2" fill="#b9ae99" opacity="0.35"/>`,
      )
      .join("")}
  `,
};

const gradients: Record<CardKind, [string, string]> = {
  newyear: ["#fdf3e7", "#f0c9a0"],
  summer: ["#f2fbfd", "#bfe4ef"],
  birthday: ["#fff6fa", "#f9d3e2"],
  wedding: ["#fffaf5", "#f6e3cf"],
  baby: ["#f7fbff", "#e3eefb"],
  thanks: ["#fffdf6", "#f5ecd4"],
  custom: ["#fbf8f1", "#ece5d6"],
};

// SVG を「data:」から始まる文字列にして返します。
// この形にしておくと、CSS でも canvas でも、そのまま画像として使えます。
export function cardBackgroundUrl(kind: CardKind): string {
  const [from, to] = gradients[kind];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${from}"/>
        <stop offset="100%" stop-color="${to}"/>
      </linearGradient>
    </defs>
    <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#g)"/>
    ${patterns[kind]}
  </svg>`;

  // encodeURIComponent = URL に使えない文字を安全な形に直す関数。
  // SVG の中の記号や引用符をそのまま入れると壊れるので、必ず通します。
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
