import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ▼ 本番の速さを測りたいときのための指定
  // 開発サーバー(npm run dev)は .next を使い続けているので、
  // そのまま build すると、お互いを壊し合います。
  // 別の場所へ吐き出せば、開発サーバーを止めずに本番を確認できます。
  //
  //   NEXT_DIST_DIR=.next-prod npx next build
  //   NEXT_DIST_DIR=.next-prod npx next start -p 3002
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // ▼ allowedDevOrigins とは？
  // 開発中の Next.js は、localhost 以外からの接続を、
  // 安全のために拒否します。
  // そのため、スマホから http://192.168.x.x:3000 で開くと、
  // 画面の見た目(HTML)は届くのに、
  // 中身を動かすJavaScriptだけが弾かれます。
  // 結果、ボタンも描画も、何も反応しない状態になります。
  //
  // ここに書いたアドレスからの接続だけ、許可されます。
  // 開発中だけの設定なので、本番には影響しません。
  //
  // * は「1区切りぶん、何でもよい」という意味です。
  // PCのアドレスは Wi-Fi をつなぎ直すと変わるので、
  // 1つずつ書くのではなく、家庭やキャンパスでよく使われる範囲をまとめて許可しています。
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
};

export default nextConfig;
