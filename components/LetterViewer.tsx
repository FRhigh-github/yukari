// 届いた「未来への手紙」を、1通ずつ見せる部品です（/letters/<id>）。
//
//   左右にスライド / 左右の矢印 … 前後の手紙へ
//   日程調整のボタン            … その手紙にイベントが付いているときだけ出ます
//
// 開いた手紙は「読んだ」とブラウザに覚えておきます。
// ホームの ✈️ の赤い印（MemberCircles.tsx）は、これを見て消えます。

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDrag } from "@use-gesture/react";

// ホームの ✈️ と同じ名前で覚えます（MemberCircles.tsx と合わせています）
const READ_KEY = "read_letter_ids";
// これ以上指が横に動いたら「スライドした」とみなします（px）
const SWIPE = 60;

export type Letter = {
  id: string;
  body: string | null;
  openAt: string;
  imageUrl: string | null;
  // 付いているイベント（日程調整）の id。無ければ null
  eventId: string | null;
  authorName: string | null;
};

type LetterViewerProps = {
  letters: Letter[];
  // 最初に開く手紙
  initialId: string;
};

export default function LetterViewer({ letters, initialId }: LetterViewerProps) {
  const [index, setIndex] = useState(() =>
    Math.max(0, letters.findIndex((letter) => letter.id === initialId)),
  );

  const letter = letters[index];
  const isLocked = letter !== undefined && new Date(letter.openAt) > new Date();

  // ▼ 開いた手紙を「読んだ」と覚えます。まだ開封日前の手紙（自分が書いたもの）は数えません
  useEffect(() => {
    if (letter === undefined || isLocked) return;
    try {
      const readIds: string[] = JSON.parse(localStorage.getItem(READ_KEY) ?? "[]");
      if (!readIds.includes(letter.id)) {
        localStorage.setItem(READ_KEY, JSON.stringify([...readIds, letter.id]));
      }
    } catch {
      // 覚えられない環境（プライベートブラウズなど）でも、読むことはできます
    }
  }, [letter, isLocked]);

  const goNewer = () => setIndex(Math.max(0, index - 1));
  const goOlder = () => setIndex(Math.min(letters.length - 1, index + 1));

  // ▼ 左右のスライドは、@use-gesture/react というライブラリで受け取ります。
  //   縦に送り始めた（本文をスクロールした）ときなど、途中で打ち切られた操作も
  //   ライブラリが「離した」として知らせてくれます。
  //   last = 指を離した瞬間 / movement = 触れた所から動いた量
  const bindPaper = useDrag(
    ({ last, movement: [dx] }) => {
      if (!last) return;
      // 左へスライド → 古い手紙へ、右へ → 新しい手紙へ
      if (dx < -SWIPE) goOlder();
      if (dx > SWIPE) goNewer();
    },
    // capture: false = 指をこの枠に縛りつけません。
    // 縛ると、枠の中にある左右の矢印を押しても、押したことにならなくなるためです
    { pointer: { capture: false } },
  );

  // 「2030年4月1日」の形。書く画面の「〇年〇月〇日の私たちへ」と同じ言い方にします
  const dateText = letter
    ? new Date(letter.openAt).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
        // サーバーで描いても日本の日付にするため（サーバーの時計は世界標準時）
        timeZone: "Asia/Tokyo",
      })
    : "";

  return (
    // h-full = 親の高さぴったり。前は画面の高さで作っていて、下タブと重なっていました
    <div className="flex h-full flex-col bg-[#f3ede2] pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      {/* ▼ 上：戻る・宛名・何通目か */}
      <header className="flex shrink-0 items-center gap-1 px-2 pt-2">
        <Link
          href="/"
          aria-label="ホームへ戻る"
          className="flex h-11 w-11 items-center justify-center text-stone-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-7 w-7"><path d="M15 5l-7 7 7 7" /></svg>
        </Link>
        {letter ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold text-stone-800">{dateText}の私たちへ</p>
            {letter.authorName ? (
              <p className="truncate text-sm text-kin">{letter.authorName}より</p>
            ) : null}
          </div>
        ) : null}
        {letters.length > 1 ? (
          <span className="shrink-0 pr-3 text-sm text-stone-500">
            {index + 1} / {letters.length}
          </span>
        ) : null}
      </header>

      {/* ▼ 真ん中：手紙の紙。左右にスライドすると、前後の手紙へ移ります */}
      <div
        className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center px-4 py-3"
        {...bindPaper()}
      >
        {letter === undefined ? (
          <p className="text-base text-stone-500">手紙はまだありません</p>
        ) : isLocked ? (
          // ▼ まだ開封日前（自分が書いた手紙だけがここに来ます）。鍵の絵と、開く日だけを出します
          <div className="flex flex-col items-center gap-3 text-kin">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-20 w-20"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            <p className="text-base font-bold text-stone-700">{dateText}</p>
          </div>
        ) : letter.imageUrl ? (
          // ▼ 紙の画像。文字も飾りも、この1枚に全部入っています。
          //   前は画像の下に本文をもう一度出していて、同じ文が2回見えていました
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={letter.imageUrl}
            alt={letter.body ?? "手紙"}
            draggable={false}
            className="max-h-full max-w-full rounded-sm object-contain shadow-lg ring-1 ring-kin/40"
          />
        ) : (
          // 画像が無い手紙（前のデータ）は、本文を紙の上に出します
          <div className="max-h-full w-full overflow-y-auto rounded-sm bg-[#fdfbf5] p-6 shadow-lg ring-1 ring-kin/40">
            <p className="whitespace-pre-wrap text-base leading-relaxed text-stone-800">
              {letter.body}
            </p>
          </div>
        )}

        {/* 左右の矢印。スライドに気づかない人のために、端にも置きます */}
        {index > 0 ? (
          <button
            type="button"
            onClick={goNewer}
            aria-label="新しい手紙へ"
            className="absolute left-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-kin"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-7 w-7"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
        ) : null}
        {index < letters.length - 1 ? (
          <button
            type="button"
            onClick={goOlder}
            aria-label="前の手紙へ"
            className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-kin"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-7 w-7"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        ) : null}
      </div>

      {/* ▼ 下：日程調整へ。イベントが付いていて、開封済みの手紙のときだけ出します */}
      {letter && letter.eventId && !isLocked ? (
        <div className="flex shrink-0 justify-center pt-1">
          <Link
            href={`/events/${letter.eventId}`}
            className="flex h-12 items-center gap-2 rounded-full bg-beni px-6 text-base font-bold text-white ring-1 ring-kin ring-offset-2 ring-offset-[#f3ede2]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" /></svg>
            日程調整
          </Link>
        </div>
      ) : null}
    </div>
  );
}
