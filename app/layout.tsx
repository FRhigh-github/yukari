import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

// フォントは globals.css で端末の標準フォントを指定しています。

export const metadata: Metadata = {
  title: "ゆかり",
  description: "大切な人に、ご報告を届けるアプリ",
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
        <div className="mx-auto flex h-[100dvh] max-w-sm flex-col bg-white shadow-xl">
          {/* 下タブは常に見えたまま、中身だけがスクロールします。
              min-h-0 は、flex の中で overflow を効かせるために必要な指定です。 */}
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
