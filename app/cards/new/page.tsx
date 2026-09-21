// カードを作る画面です。
//
// ここではDBに一切聞きません。背景はコードに書いてあり、
// 送る相手は「送る」を押したときに初めて取りに行くためです。
// おかげで、この画面は待ち時間ゼロで開きます。

import Link from "next/link";
import CardComposer from "@/components/CardComposer";
import { CARD_KINDS } from "@/components/CardTemplate";

export default async function NewCardPage({
  searchParams,
}: PageProps<"/cards/new">) {
  // 前の画面で選んだ背景の種類（"newyear" など）が入ってきます
  const { background } = await searchParams;

  const selectedKind = CARD_KINDS.find((item) => item.kind === background)?.kind;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-5 pt-3">
        <Link href="/cards" className="text-sm text-stone-500">
          ← 戻る
        </Link>
      </div>

      <div className="min-h-0 flex-1">
        <CardComposer initialKind={selectedKind ?? CARD_KINDS[0].kind} />
      </div>
    </div>
  );
}
