import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import OpeningAnimation from "@/components/OpeningAnimation";

// フォントは globals.css で端末の標準フォントを指定しています。

export const metadata: Metadata = {
  title: "ゆかり",
  description: "大切な人に、ご報告を届けるアプリ",

  // iPhone でホーム画面から開いたときに、アプリとして立ち上がるための指定
  appleWebApp: {
    capable: true,
    title: "ゆかり",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,

  // 指2本でつまんだときに、画面を拡大できないようにします。
  // アプリらしくするためと、誤操作で表示が崩れるのを防ぐためです。
  maximumScale: 1,
  userScalable: false,

  // ノッチ（画面上の切り欠き）の下まで表示を広げます。
  // 代わりに、文字が隠れないよう globals.css で余白を足しています。
  viewportFit: "cover",
  // 一番上（時計や電池が並ぶ帯）の色。ホームの背景と同じ生成り色にしています。
  // ストーリー画面（StoryViewer）を開いている間だけ、そちらで暗い色に変えます
  themeColor: "#faf9f6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning = この札に目印を足しても怒らないでね、という指定。
    // 下の小さな処理が data-opening-seen を付けるので、
    // サーバーが作ったHTMLとは中身が変わります。ここだけは想定どおりです。
    <html lang="ja" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* preconnect = その相手との接続だけ、先に始めておく指定。
            アイコンは外部から読むので、画像のURLが分かってから
            接続を始めると、そのぶん表示が遅れます。
            スマホの回線ほど、この待ち時間が大きくなります。 */}
        <link rel="preconnect" href="https://lh3.googleusercontent.com" />
        <link rel="preconnect" href="https://i.pravatar.cc" />

        {/* 投稿の写真とカードの絵は Supabase に置いてあります。
            ここへの接続も先に始めておきます。
            URLが分かってから繋ぎ始めると、そのぶん写真が遅れて出ます。 */}
        {process.env.NEXT_PUBLIC_SUPABASE_URL ? (
          <link
            rel="preconnect"
            href={process.env.NEXT_PUBLIC_SUPABASE_URL}
            crossOrigin=""
          />
        ) : null}

        {/* 読み込み中に出す結び目です。
            <yukari-loader> という自前のタグを使えるようにする部品で、
            中身は public/yukari-loader.js にそのまま置いてあります。
            ここで一度読んでおくと、loading のたびに取りに行かずにすみます。 */}
        <script src="/yukari-loader.js" async />

        {/* ▼ オープニングを出すかどうかを、いちばん最初に決めるための小さな処理です。
            React が動き出すのを待つと、その一瞬だけ紐が見えてしまいます
            （読み込み直したときに、毎回ちらっと出る）。
            ここは HTML を読みながらすぐ実行されるので、描かれる前に間に合います。
            目印を html に付けておくと、globals.css がそれを見て隠します。 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem('yukari-opening-seen'))document.documentElement.dataset.openingSeen='1'}catch(e){}`,
          }}
        />
      </head>
      {/* 外側の灰色。PCで見たとき、アプリの外にあたる部分です */}
      <body className="min-h-full bg-stone-200">
        {/* アプリ本体。max-w-[430px] + mx-auto で、スマホ1台ぶんを真ん中に置きます。
            430px は、いちばん大きい iPhone（Pro Max）の幅です。
            前は max-w-sm(384px) で、ふつうの iPhone（390〜402px）より細く、
            左右に外側の色が細い帯になって見えていました。
            100dvh = 今この瞬間に見えている画面の高さ。
            スマホは上下のバーが出たり引っ込んだりするので、
            100vh だとはみ出します。dvh はそれに追従します。 */}
        {/* relative = この枠の中を、位置指定の基準にする（オープニングがここに収まります） */}
        <div className="relative mx-auto flex h-full max-w-[430px] flex-col bg-white shadow-xl">
          {/* 下タブは常に見えたまま、中身だけがスクロールします。
              min-h-0 = flex の中で overflow を効かせるために必要な指定。
              overscroll-contain = 中身を端まで送っても、外側に影響させない。
              pt-[env(safe-area-inset-top)] = ノッチのぶんだけ上に余白を空ける。 */}
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)]">
            {children}
          </main>
          <BottomNav />

          {/* アプリを開いたときのアニメーション。
              この枠いっぱいにかぶさるので、スマホの画面に収まります。 */}
          <OpeningAnimation />
        </div>
      </body>
    </html>
  );
}
