import Link from "next/link";
import { CARD_KINDS } from "@/components/CardTemplate";

// カードの種類を選ぶ画面。4つのタイルを並べるだけです。
export default function CardKindPage() {
  return (
    <main className="p-6">
      <Link href="/cards" className="text-sm text-stone-500">
        ← 戻る
      </Link>

      <h1 className="mb-4 mt-2 text-xl font-bold text-stone-800">
        メッセージカード選択
      </h1>

      {/* grid-cols-2 = 横に2つずつ並べる */}
      <div className="grid grid-cols-2 gap-3">
        {CARD_KINDS.map((item) => (
          <Link
            key={item.kind}
            href={`/cards/send/${item.kind}`}
            className="flex h-36 items-center justify-center rounded-xl bg-[#f3ede2] px-3 text-center text-sm text-stone-700"
          >
            {item.label}
          </Link>
        ))}

        <Link
          href="/cards/send/all"
          className="col-span-2 flex h-20 items-center justify-center rounded-xl bg-[#f3ede2] text-sm text-stone-700"
        >
          全て
        </Link>
      </div>
    </main>
  );
}
