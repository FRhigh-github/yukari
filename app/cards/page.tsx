import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CardTemplate, {
  CARD_KINDS,
  type CardKind,
} from "@/components/CardTemplate";
import HorizontalScroller from "@/components/HorizontalScroller";

// カードのタブは、いきなり「背景えらび」から始まります。
//
// DBのテーブル名は card_templates ですが、画面では「背景」と呼んでいます。
// 完成品を選ぶのではなく、土台を選んで、その上に自分で置いていく形だからです。
// 種類は上の並びで絞り込みます（/cards?kind=newyear）。
export default async function CardsPage({
  searchParams,
}: PageProps<"/cards">) {
  const { kind } = await searchParams;
  const selectedKind = typeof kind === "string" ? kind : null;

  const supabase = await createClient();

  const query = supabase.from("card_templates").select("id, kind, name");
  const { data: templates } = await (selectedKind
    ? query.eq("kind", selectedKind)
    : query);

  return (
    <main className="p-5">
      <h1 className="text-xl font-bold text-stone-800">メッセージカード</h1>
      <p className="mb-3 mt-1 text-xs text-stone-500">背景をえらんでください</p>

      {/* 種類の絞り込み。左右のボタンで送れます */}
      <HorizontalScroller className="mb-4">
        <KindChip label="全て" href="/cards" isActive={selectedKind === null} />
        {CARD_KINDS.map((item) => (
          <KindChip
            key={item.kind}
            label={item.label}
            href={`/cards?kind=${item.kind}`}
            isActive={selectedKind === item.kind}
          />
        ))}
      </HorizontalScroller>

      {/* 大きさは全部そろえます。
          aspect-[2/3] = 縦横の比。実際のカードと同じ形です。 */}
      <div className="grid grid-cols-2 gap-3 pb-6">
        {templates?.map((template) => (
          <Link
            key={template.id}
            href={`/cards/new?template=${template.id}`}
            className="block"
          >
            <CardTemplate
              kind={template.kind as CardKind}
              name={template.name}
              className="aspect-[2/3] w-full"
            />
          </Link>
        ))}
      </div>

      {templates?.length === 0 ? (
        <p className="text-sm text-stone-500">背景がありません。</p>
      ) : null}
    </main>
  );
}

type KindChipProps = {
  label: string;
  href: string;
  isActive: boolean;
};

function KindChip({ label, href, isActive }: KindChipProps) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full px-4 py-2 text-xs ${
        isActive ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-600"
      }`}
    >
      {label}
    </Link>
  );
}
