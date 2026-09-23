// チャットの一覧です。ホームの上のバーのふきだしから来ます。
//
// チャットはイベント（未来への手紙に付けた日程調整）ごとにあるので、
// 見られるイベントを新しい順に並べて、押すとそのチャットへ移ります。
// events は RLS で「同じコミュニティで、手紙が開いたもの（と自分が作ったもの）」だけが返ります。

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ChatsPage() {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-full bg-[#faf9f6] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <header className="flex items-center gap-1 border-b border-kin/30 px-2 py-1">
        <Link href="/" aria-label="ホームへ戻る" className="flex h-11 w-11 items-center justify-center text-stone-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-7 w-7"><path d="M15 5l-7 7 7 7" /></svg>
        </Link>
        <h1 className="text-lg font-bold text-stone-800">チャット</h1>
      </header>

      {events === null || events.length === 0 ? (
        <p className="py-20 text-center text-base text-stone-500">まだチャットはありません</p>
      ) : (
        <ul className="divide-y divide-kin/20">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/events/${event.id}/chat`}
                className="flex min-h-16 items-center gap-3 px-4 py-3"
              >
                {/* ふきだしの絵 */}
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-kin ring-1 ring-kin/60">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-6 w-6"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
                </span>
                <span className="min-w-0 flex-1 truncate text-base font-bold text-stone-800">
                  {event.name}
                </span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5 shrink-0 text-stone-300"><path d="M9 5l7 7-7 7" /></svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
