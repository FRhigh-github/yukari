// PWA（ホーム画面に追加したときの設定）です。
// app/manifest.ts という名前にすると、Next.js が自動で配信してくれます。
//
// display: "standalone" が一番大事です。
// これがあると、ホーム画面から開いたときに
// ブラウザのアドレスバーと下のバーが消え、アプリとして立ち上がります。
// バーが無くなるので、上のボヤけも、引っぱったときの跳ね返りも起きません。

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ゆかり",
    short_name: "ゆかり",
    description: "大切な人に、ご報告を届けるアプリ",
    start_url: "/",
    display: "standalone",
    // オープニングと同じ生成り色。立ち上がりの一瞬もこの色になります
    background_color: "#faf8f3",
    theme_color: "#ffffff",
    orientation: "portrait",
    icons: [
      {
        // app/icon.svg に置いた結び目。
        // svg は大きさを持たないので、どの端末でもきれいに出ます。
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        // ▼ iPhone のホーム画面は svg を受け付けません。
        //   同じ絵を 512px の png にしたものを、こちらに置いています。
        //   （app/apple-icon.png という名前にすると、
        //     Next.js が apple-touch-icon としても出してくれます）
        src: "/apple-icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
