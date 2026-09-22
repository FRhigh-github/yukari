// 招待コードで参加するだけの画面です。

import Link from "next/link";
import CommunityJoinForm from "@/components/CommunityJoinForm";
import HintOverlay from "@/components/HintOverlay";
import { SHOW_HINTS } from "@/lib/tutorial";

export default async function JoinCommunityPage({
  searchParams,
}: PageProps<"/communities/join">) {
  // ?from=start = アカウントを作った直後に来た人
  const { from } = await searchParams;
  const isFirstTime = from === "start";

  return (
    <main className="relative space-y-6 p-6 pb-24">
      {SHOW_HINTS && isFirstTime ? (
        <HintOverlay text="招待コードは、その輪にいる人からもらいます。" />
      ) : null}

      <div>
        <Link
          href={isFirstTime ? "/start" : "/"}
          className="text-sm text-stone-500"
        >
          ← {isFirstTime ? "戻る" : "ホーム"}
        </Link>
        <h1 className="mt-2 text-xl font-bold text-stone-800">
          招待コードで参加する
        </h1>
        <p className="mt-2 text-xs text-stone-400">
          作った人からもらった6文字を入れてください。
        </p>
      </div>

      <CommunityJoinForm isFirstTime={isFirstTime} />
    </main>
  );
}
