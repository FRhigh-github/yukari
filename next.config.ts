import type { NextConfig } from "next";

// ▼ 読み込んでよい場所の一覧（Content-Security-Policy）
//   万一、誰かが画面にプログラムや画像を紛れ込ませても、ここに無い場所からは読み込めません。
//   たとえば、よそのサイトの画像（見た人を記録する仕掛け）や、よそへのデータの送信を止めます。
//
//   self      = このアプリ自身
//   supabase  = DB・保管庫（写真）・リアルタイム（チャット）
//   lh3.googleusercontent.com = Google で登録した人のアイコン
//   data: / blob: = その場で作った画像（カードの写真、手紙の写真のお試しなど）
//   フォントは next/font がアプリの中に取り込むので、self だけで足ります。
//
//   script-src の 'unsafe-inline' は、app/layout.tsx の小さな処理と、
//   Next.js が HTML に埋め込む処理のために要ります。
//   開発中（npm run dev）だけは、React の開発用の道具が eval を使うので 'unsafe-eval' も足します
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabaseUrl.replace(/^https:/, "wss:");
const isDev = process.env.NODE_ENV !== "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseUrl} https://lh3.googleusercontent.com`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseUrl} ${supabaseWs}${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

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

  // ▼ すべての画面に付ける、身を守るための指定（セキュリティヘッダー）
  //
  // X-Frame-Options / frame-ancestors
  //   = 別のサイトが、このアプリを自分のページの中に埋め込めないようにします。
  //     埋め込まれると、透明にして重ねたボタンを押させる、といういたずら
  //     （クリックジャッキング）ができてしまうためです。
  // X-Content-Type-Options: nosniff
  //   = ファイルの種類をブラウザに推測させません。
  //     画像のふりをした別物を、プログラムとして動かされるのを防ぎます。
  // Referrer-Policy
  //   = 外のサイトへ移るとき、どの画面から来たかを「ドメインだけ」しか伝えません。
  //     URL の中の id（/members/xxxx など）が外に漏れないようにします。
  // Permissions-Policy
  //   = 使わない機能（位置情報・マイク・カメラの直接利用）を、最初から使えなくします。
  //     写真を選ぶ <input type="file"> は、この指定の影響を受けません。
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          // 読み込んでよい場所の一覧（上の contentSecurityPolicy）。
          // frame-ancestors 'none' も含めています（X-Frame-Options と同じ役目）
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), camera=()",
          },
        ],
      },
    ];
  },

  experimental: {
    // ▼ 一度見た画面を、ブラウザにどれだけ覚えておいてもらうか（秒）
    //
    // この版の初期値は dynamic: 0 で、「覚えない」です。
    // そのため、同じ画面に戻るたびにDBへ聞きに行っていました。
    //
    // dynamic = DBに聞いて作る画面（ホーム、カード一覧、メンバー）
    // static  = 中身が決まっている画面
    //
    // 180秒＝3分にしてあります。
    // 長くするほど、他の人の新しいご報告が出てくるのが遅くなりますが、
    // ホームは上から引っぱれば取り直せるようにしたので、困りません。
    // 自分がご報告を書いた・カードを送ったなどの直後は
    // router.refresh() で取り直しているので、古いまま残ることはありません。
    staleTimes: {
      dynamic: 180,
      static: 300,
    },
  },
};

export default nextConfig;
