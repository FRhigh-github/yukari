import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CardTemplate, { type CardKind } from "@/components/CardTemplate";

export default async function CardsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS のおかげで、自分が送ったものと受け取ったものだけが返ります。
  // ここでは「受け取ったもの」に絞ります。
  const { data: cards } = user
    ? await supabase
        .from("card_sends")
        .select("id, message, sent_at, from_user, template_id")
        .eq("to_user", user.id)
        .order("sent_at", { ascending: false })
    : { data: null };

  // 送り主の名前と、テンプレートの見た目をまとめて取ります
  const [{ data: senders }, { data: templates }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", cards?.map((card) => card.from_user) ?? []),
    supabase
      .from("card_templates")
      .select("id, kind, name")
      .in("id", cards?.map((card) => card.template_id) ?? []),
  ]);

  return (
    <main className="relative min-h-full p-6">
      <h1 className="mb-4 text-xl font-bold text-stone-800">届いたカード</h1>

      {cards?.length === 0 || cards === null ? (
        <p className="text-sm text-stone-500">まだ届いていません。</p>
      ) : (
        <ul className="space-y-3 pb-24">
          {cards.map((card) => {
            const template = templates?.find(
              (item) => item.id === card.template_id,
            );
            const sender = senders?.find((item) => item.id === card.from_user);

            return (
              <li
                key={card.id}
                className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm"
              >
                {template ? (
                  <CardTemplate
                    kind={template.kind as CardKind}
                    name={template.name}
                    className="h-24 w-20 shrink-0"
                  />
                ) : null}

                <div className="min-w-0 flex-1">
                  <p className="text-xs text-stone-400">
                    {new Date(card.sent_at).toLocaleDateString("ja-JP")}
                  </p>
                  <p className="mt-1 text-sm font-bold text-stone-800">
                    {sender?.display_name ?? "名無し"} さんから
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">
                    {card.message}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* 送る画面への入口。ご報告の「ステキな報告をする」と同じ位置です */}
      <Link
        href="/cards/send"
        className="fixed bottom-24 left-1/2 ml-[7rem] -translate-x-1/2 rounded-full bg-stone-700 px-5 py-2.5 text-xs font-bold text-white shadow-lg"
      >
        カードを送る
      </Link>
    </main>
  );
}
