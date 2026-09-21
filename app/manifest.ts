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
    background_color: "#ffffff",
    theme_color: "#ffffff",
    orientation: "portrait",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
