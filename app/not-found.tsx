// 存在しない URL を開いたときに出す画面です。
// これが無いと、Next.js が用意した英語の「404」画面が出ます。

import Link from "next/link";
import KnotMark from "@/components/KnotMark";

export default function NotFound() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-5 bg-[#faf9f6] p-8 text-center">
      <KnotMark />
      <div className="space-y-1">
        <h1 className="text-lg font-bold text-stone-800">ページが見つかりませんでした</h1>
        <p className="text-sm text-stone-500">URL が変わったか、消えてしまったようです。</p>
      </div>
      <Link
        href="/"
        className="flex h-12 w-full max-w-xs items-center justify-center rounded-full bg-beni text-base font-bold text-white"
      >
        ホームへ戻る
      </Link>
    </main>
  );
}
