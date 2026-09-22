// アカウントを作ったあと、最初に通る画面です。
//
// この時点ではどのコミュニティにも入っていないので、
// ホームへ送っても誰もいない相関図が出るだけになります。
// 先に「入る」か「作る」かを選んでもらいます。

import Link from "next/link";
import KnotMark from "@/components/KnotMark";
import HintOverlay from "@/components/HintOverlay";
import { SHOW_HINTS } from "@/lib/tutorial";

export default function StartPage() {
  return (
    // relative = ヒントをこの枠の中に重ねるため
    <main className="relative flex h-full flex-col justify-center gap-6 p-8">
      {SHOW_HINTS ? (
        <HintOverlay text="ゆかりは、大切な人たちの輪ごとに分かれています。" />
      ) : null}

      <KnotMark />

      <div className="space-y-3">
        {/* 誘われて来た人のほうが多いはずなので、こちらを上に置きます */}
        <Link
          href="/communities/join?from=start"
          className="block rounded-full bg-stone-800 py-3.5 text-center text-sm font-bold text-white"
        >
          招待コードで参加する
        </Link>

        <Link
          href="/communities/new?from=start"
          className="block rounded-full border-2 border-stone-800 py-3.5 text-center text-sm font-bold text-stone-800"
        >
          コミュニティを新しく作る
        </Link>
      </div>

      <Link href="/?tour=1" className="text-center text-xs text-stone-500">
        あとにする
      </Link>
    </main>
  );
}
