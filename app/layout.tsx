import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

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
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      {/* 外側の灰色。PCで見たとき、アプリの外にあたる部分です */}
      <body className="min-h-full bg-stone-200">
        {/* アプリ本体。max-w-sm(384px) + mx-auto で、スマホ1台ぶんを真ん中に置きます。
            100dvh = 今この瞬間に見えている画面の高さ。
            スマホは上下のバーが出たり引っ込んだりするので、
            100vh だとはみ出します。dvh はそれに追従します。 */}
        <div className="mx-auto flex h-full max-w-sm flex-col bg-white shadow-xl">
          {/* 下タブは常に見えたまま、中身だけがスクロールします。
              min-h-0 = flex の中で overflow を効かせるために必要な指定。
              overscroll-contain = 中身を端まで送っても、外側に影響させない。
              pt-[env(safe-area-inset-top)] = ノッチのぶんだけ上に余白を空ける。 */}
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)]">
            {children}
          </main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
