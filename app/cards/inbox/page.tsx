import Link from "next/link";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import ReceivedCard from "@/components/ReceivedCard";
import type { CardKind } from "@/components/CardTemplate";
import { getSignedUrls } from "@/lib/signedUrls";

export default async function CardInboxPage({
  searchParams,
}: PageProps<"/cards/inbox">) {
  // ?box=sent で「送ったカード」に切り替えます
  const { box } = await searchParams;
  const isSent = box === "sent";

  const supabase = await createClient();

  // ▼ 1回目：本人確認と、カードの取得を同時に出します。
  //
  //   前は「本人確認 → その id でカードを絞る」と2段階でしたが、
  //   RLS が「自分が関わったカードしか返さない」ので、
  //   先に全部もらって、届いた／送ったの仕分けはこちらでやります。
  // 本人確認。通信なしで済みます（lib/supabase/server.ts の getCurrentUserId）
  const userId = await getCurrentUserId(supabase);
  const user = userId === null ? null : { id: userId };

  // ▼ 前は本人確認と同時に「全部」取って、こちら側で選り分けていました。
  //   1往復ぶん速くなりますが、届いたぶんが欲しいときに
  //   送ったぶんまで運んでくることになります。
  //   欲しいほうだけをDBに絞ってもらうほうが、結局は軽く済みます。
  //
  //   message は画面で使っていないので外しました。
  //   drawing_data（置いたものの一覧）も、ここでは要りません。
  const { data: cards } = user
    ? await supabase
        .from("card_sends")
        .select("id, sent_at, from_user, to_user, template_id, drawing_url")
        .eq(isSent ? "from_user" : "to_user", user.id)
        .order("sent_at", { ascending: false })
        .limit(50)
    : { data: null };

  // カードの絵は cards という保管庫に入っています。
  // 非公開なので、見るには期限付きの URL を発行してもらいます。
  const drawingPaths =
    cards
      ?.map((card) => card.drawing_url)
      .filter((path): path is string => path !== null) ?? [];

  // ▼ 2回目：この3つは、カードが分かればどれも同時に出せます
  const [{ data: senders }, { data: backgrounds }, findDrawingUrl] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name")
        .in(
          "id",
          cards?.map((card) => (isSent ? card.to_user : card.from_user)) ?? [],
        ),
      supabase
        .from("card_templates")
        .select("id, kind, name")
        .in("id", cards?.map((card) => card.template_id) ?? []),
      // URL は lib/signedUrls.ts で作ります（同じカードには同じURLを返すので、絵を使い回せます）
      getSignedUrls("cards", drawingPaths),
    ]);

  return (
    // 色はホームにそろえています（生成りの背景・金のふち・紅は「カードを作る」だけ）
    <main className="relative min-h-full bg-[#faf9f6] px-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] pt-4">
      <Link href="/" className="text-sm text-stone-500">
        ← 戻る
      </Link>
      <h1 className="mb-3 mt-2 border-b border-kin/30 pb-2 text-xl font-bold text-stone-800">カード</h1>

      <div className="mb-4 flex gap-2">
        <BoxTab label="届いた" href="/cards/inbox" isActive={!isSent} />
        <BoxTab label="送った" href="/cards/inbox?box=sent" isActive={isSent} />
      </div>

      {cards === null || cards.length === 0 ? (
        <p className="text-sm text-stone-500">
          {isSent ? "まだ送っていません。" : "まだ届いていません。"}
        </p>
      ) : (
        // 2列に並べます。下の余白は main の pb でまとめて取っています
        <ul className="grid grid-cols-2 gap-4">
          {cards.map((card) => {
            const background = backgrounds?.find(
              (item) => item.id === card.template_id,
            );

            return (
              <li key={card.id}>
                <ReceivedCard
                  imageUrl={findDrawingUrl(card.drawing_url)}
                  partnerName={
                    senders?.find(
                      (item) =>
                        item.id === (isSent ? card.to_user : card.from_user),
                    )?.display_name ?? null
                  }
                  suffix={isSent ? "さんへ" : "さんから"}
                  sentAt={card.sent_at}
                  kind={(background?.kind ?? "custom") as CardKind}
                  backgroundName={background?.name ?? ""}
                />
              </li>
            );
          })}
        </ul>
      )}

      {/* 右下に浮かせて出します（この画面には下タブが無いので、下の端の近くに置けます） */}
      <Link
        href="/cards"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-1/2 ml-[6rem] flex h-11 -translate-x-1/2 items-center rounded-full bg-beni px-5 text-sm font-bold text-white ring-1 ring-kin ring-offset-2 ring-offset-[#faf9f6]"
      >
        カードを作る
      </Link>
    </main>
  );
}

type BoxTabProps = {
  label: string;
  href: string;
  isActive: boolean;
};

function BoxTab({ label, href, isActive }: BoxTabProps) {
  return (
    <Link
      href={href}
      // h-11 = 44px。押せる範囲を iOS の基準に合わせています
      className={`flex h-11 items-center rounded-full border px-5 text-sm ${
        isActive
          ? "border-kin bg-white font-bold text-kin"
          : "border-transparent text-stone-500"
      }`}
    >
      {label}
    </Link>
  );
}
