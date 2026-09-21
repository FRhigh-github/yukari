// コミュニティを作るだけの画面です。
//
// 前は一覧ページの下にフォームが開く形でしたが、
// 「作る」を押したのに一覧が出てくるのが分かりにくかったので、
// やることが1つだけの画面に分けました。

import Link from "next/link";
import CommunityCreateForm from "@/components/CommunityCreateForm";

export default function NewCommunityPage() {
  return (
    <main className="space-y-6 p-6 pb-24">
      <div>
        <Link href="/" className="text-sm text-stone-500">
          ← ホーム
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
