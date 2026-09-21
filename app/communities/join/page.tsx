// 招待コードで参加するだけの画面です。

import Link from "next/link";
import CommunityJoinForm from "@/components/CommunityJoinForm";

export default function JoinCommunityPage() {
  return (
    <main className="space-y-6 p-6 pb-24">
      <div>
        <Link href="/" className="text-sm text-stone-500">
          ← ホーム
        </Link>
        <h1 className="mt-2 text-xl font-bold text-stone-800">
          招待コードで参加する
        </h1>
        <p className="mt-2 text-xs text-stone-400">
          作った人からもらった6文字を入れてください。
        </p>
      </div>

      <CommunityJoinForm />
    </main>
  );
}
