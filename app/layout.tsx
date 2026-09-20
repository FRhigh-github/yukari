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
        {/* アプリ本体。max-w-sm(384px) + mx-auto で、スマホ1台ぶんを真ん中に置きます */}
        <div className="mx-auto flex min-h-screen max-w-sm flex-col bg-white shadow-xl">
          <main className="flex-1">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
