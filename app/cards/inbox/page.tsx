import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ReceivedCard from "@/components/ReceivedCard";
import type { CardKind } from "@/components/CardTemplate";

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
  const [userResult, { data: allCards }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("card_sends")
      .select("id, message, sent_at, from_user, to_user, template_id, drawing_url")
      .order("sent_at", { ascending: false }),
  ]);

  const user = userResult.data.user;

  const cards =
    user === null
      ? null
      : (allCards?.filter((card) =>
          isSent ? card.from_user === user.id : card.to_user === user.id,
        ) ?? null);

  // カードの絵は cards という保管庫に入っています。
  // 非公開なので、見るには期限付きの URL を発行してもらいます（1時間）。
  const drawingPaths =
    cards
      ?.map((card) => card.drawing_url)
      .filter((path): path is string => path !== null) ?? [];

  // ▼ 2回目：この3つは、カードが分かればどれも同時に出せます
  const [{ data: senders }, { data: backgrounds }, { data: drawingUrls }] =
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
      drawingPaths.length > 0
        ? supabase.storage.from("cards").createSignedUrls(drawingPaths, 3600)
        : Promise.resolve({ data: null }),
    ]);

  const findDrawingUrl = (path: string | null) =>
    path === null
      ? null
      : (drawingUrls?.find((item) => item.path === path)?.signedUrl ?? null);

  return (
    <main className="relative min-h-full p-5 pb-24">
      <Link href="/" className="text-sm text-stone-500">
        ← 戻る
      </Link>
      <h1 className="mb-3 mt-2 text-xl font-bold text-stone-800">カード</h1>

      <div className="mb-4 flex gap-2">
        <BoxTab label="届いた" href="/cards/inbox" isActive={!isSent} />
        <BoxTab label="送った" href="/cards/inbox?box=sent" isActive={isSent} />
      </div>

      {cards === null || cards.length === 0 ? (
        <p className="text-sm text-stone-500">
          {isSent ? "まだ送っていません。" : "まだ届いていません。"}
        </p>
      ) : (
        // 2列に並べます
        <ul className="grid grid-cols-2 gap-4 pb-24">
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

      <Link
        href="/cards"
        className="fixed bottom-24 left-1/2 ml-[6rem] -translate-x-1/2 rounded-full bg-stone-700 px-5 py-2.5 text-xs font-bold text-white shadow-lg"
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
      className={`rounded-full px-4 py-2 text-xs ${
        isActive ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-600"
      }`}
    >
      {label}
    </Link>
  );
}
