// コミュニティを作るだけの画面です。
//
// 前は一覧ページの下にフォームが開く形でしたが、
// 「作る」を押したのに一覧が出てくるのが分かりにくかったので、
// やることが1つだけの画面に分けました。

import Link from "next/link";
import CommunityCreateForm from "@/components/CommunityCreateForm";
import HintOverlay from "@/components/HintOverlay";
import { SHOW_HINTS } from "@/lib/tutorial";

export default async function NewCommunityPage({
  searchParams,
}: PageProps<"/communities/new">) {
  // ?from=start = アカウントを作った直後に来た人
  const { from } = await searchParams;
  const isFirstTime = from === "start";

  return (
    <main className="relative space-y-6 p-6 pb-24">
      {SHOW_HINTS && isFirstTime ? (
        <HintOverlay text="家族、友だち、部活。呼びたい人の顔ぶれで分けます。" />
      ) : null}

      <div>
        <Link
          href={isFirstTime ? "/start" : "/"}
          className="text-sm text-stone-500"
        >
          ← {isFirstTime ? "戻る" : "ホーム"}
        </Link>
        <h1 className="mt-2 text-xl font-bold text-stone-800">
          コミュニティを作る
        </h1>
        <p className="mt-2 text-xs text-stone-400">
          作ると招待コードが出ます。それを渡すと、相手も入れます。
        </p>
      </div>

      <CommunityCreateForm />
    </main>
  );
}
