import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  allowedDevOrigins: ["192.168.1.23"],
};

export default nextConfig;
