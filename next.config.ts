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
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
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
