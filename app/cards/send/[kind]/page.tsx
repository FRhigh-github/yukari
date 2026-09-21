import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CardTemplate, {
  CARD_KINDS,
  type CardKind,
} from "@/components/CardTemplate";

// 高さをわざとバラバラにして、敷き詰めたように見せます。
// 順番に使い回すので、開くたびに変わることはありません。
const HEIGHTS = ["h-40", "h-28", "h-36", "h-44", "h-32"];

export default async function CardTemplateListPage({
  params,
}: PageProps<"/cards/send/[kind]">) {
  const { kind } = await params;
  const supabase = await createClient();

  // kind が "all" のときは絞りません
  const query = supabase.from("card_templates").select("id, kind, name");
  const { data: templates } = await (kind === "all"
    ? query
    : query.eq("kind", kind));

  const title =
    CARD_KINDS.find((item) => item.kind === kind)?.label ?? "メッセージカード";

  return (
    <main className="p-6">
      <Link href="/cards/send" className="text-sm text-stone-500">
        ← 戻る
      </Link>

      <h1 className="mb-4 mt-2 text-xl font-bold text-stone-800">{title}</h1>

      {/* columns-2 = 2列に流し込む。高さが違っても、うまく詰まります。
          break-inside-avoid は「1枚が2列にまたがらないように」の指定です。 */}
      <div className="columns-2 gap-3">
        {templates?.map((template, index) => (
          <Link
            key={template.id}
            href={`/cards/new?template=${template.id}`}
            className="mb-3 block break-inside-avoid"
          >
            <CardTemplate
              kind={template.kind as CardKind}
              name={template.name}
              className={`w-full ${HEIGHTS[index % HEIGHTS.length]}`}
            />
          </Link>
        ))}
      </div>

      {templates?.length === 0 ? (
        <p className="text-sm text-stone-500">テンプレートがありません。</p>
      ) : null}
    </main>
  );
}
