// 画面に置いたものを、そのまま1枚の画像にする処理です。
//
// 「見えているHTMLを写真に撮る」ような便利な道具もあるのですが、
// 外から別のライブラリを入れることになります。
// このアプリは、どこに何を置いたかを自分で持っているので、
// その数字をもとに canvas へ描き直すほうが確実で、軽く済みます。

import {
  cardBackgroundUrl,
  CARD_HEIGHT,
  CARD_WIDTH,
  TEXT_COLORS,
  type CardKind,
} from "@/lib/cardBackground";

// カードの中に置いたもの1つぶん。
// x, y, width は「カードの幅を1としたときの割合」で持ちます。
// 画面の大きさが変わっても、同じ見た目で書き出せるようにするためです。
export type CardItem =
  | { id: string; type: "text"; x: number; y: number; width: number; text: string }
  | { id: string; type: "image"; x: number; y: number; width: number; src: string };

// 書き出す大きさは、背景の絵と同じにします
const OUT_WIDTH = CARD_WIDTH;
const OUT_HEIGHT = CARD_HEIGHT;

// ▼ 文字の大きさと、置いたものの内側の余白は「カードの幅に対する割合」で決めています。
//   画面（CardComposer.tsx）でも同じ割合を使うので、見たままの位置・大きさで書き出されます。
export const FONT_RATIO = 14 / 260;
export const ITEM_PADDING_RATIO = 0.02;

export async function renderCardToBlob(
  kind: CardKind,
  items: CardItem[],
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = OUT_WIDTH;
  canvas.height = OUT_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("画像の書き出しに失敗しました");

  // 背景。画面に出しているものと同じ絵を、そのまま描きます
  const background = await loadImage(cardBackgroundUrl(kind));
  ctx.drawImage(background, 0, 0, OUT_WIDTH, OUT_HEIGHT);

  // 置いたものを、下から順に描いていきます
  const padding = OUT_WIDTH * ITEM_PADDING_RATIO;

  for (const item of items) {
    // 置いたものの枠の左上から、内側の余白ぶんだけ入った所が、中身の左上です
    const x = item.x * OUT_WIDTH + padding;
    const y = item.y * OUT_HEIGHT + padding;
    const contentWidth = item.width * OUT_WIDTH - padding * 2;

    if (item.type === "image") {
      // src は選んだ写真の中身そのもの（data:...）なので、
      // 読み込みを待ってから描きます
      const image = await loadImage(item.src);
      // 縦は元の比率のまま
      const height = (contentWidth / image.width) * image.height;
      ctx.drawImage(image, x, y, contentWidth, height);
      continue;
    }

    ctx.fillStyle = TEXT_COLORS[kind];
    ctx.textBaseline = "top";
    ctx.font = `bold ${Math.round(OUT_WIDTH * FONT_RATIO)}px sans-serif`;

    // ▼ 枠の幅で折り返して、1行ずつ下にずらして描きます。
    //   canvas は「ここで折り返す」をやってくれないので、1文字ずつ足していき、
    //   はみ出したところで次の行に送ります（画面の折り返しと合わせるため）
    const lineHeight = Math.round(OUT_WIDTH * FONT_RATIO * 1.5);
    const lines: string[] = [];
    for (const paragraph of item.text.split("\n")) {
      let line = "";
      for (const ch of paragraph) {
        if (line !== "" && ctx.measureText(line + ch).width > contentWidth) {
          lines.push(line);
          line = ch;
        } else {
          line += ch;
        }
      }
      lines.push(line);
    }
    lines.forEach((line, index) => {
      ctx.fillText(line, x, y + index * lineHeight);
    });
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.85);
  });

  if (blob === null) throw new Error("画像の書き出しに失敗しました");
  return blob;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像を読み込めませんでした"));
    image.src = src;
  });
