// 相関図のマル1つぶんです。
//
//   ふつうに押す  → その人のご報告へ
//   長押しする    → その人の小さなプロフィールが出る
//
// 長押しは「押してから指を離さずに0.5秒たったか」で判定します。
// 途中で指が動いたり離れたりしたら取り消します。

"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { MOODS } from "@/lib/mood";
import type { Member } from "@/lib/home";

// これだけ押し続けたら長押し（ミリ秒）
const LONG_PRESS = 500;

type MemberCircleProps = {
  member: Member;
  x: number;
  y: number;
};

export default function MemberCircle({ member, x, y }: MemberCircleProps) {
  // 数え終わるまでの時計。取り消すときに止めるので、持っておきます
  const timerRef = useRef<number | null>(null);

  // 長押しになったかどうか。
  // これが立っていると、指を離したときの「移動」を止めます
  // （長押ししたのにご報告へ飛んでしまうのを防ぎます）
  const longPressedRef = useRef(false);

  const [isOpen, setIsOpen] = useState(false);

  const start = () => {
    longPressedRef.current = false;
    timerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      setIsOpen(true);
    }, LONG_PRESS);
  };

  const cancel = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const mood = MOODS.find((item) => item.value === member.mood);

  return (
    <>
      <Link
        href={`/members/${member.id}`}
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerMove={cancel}
        // 長押しで開いたときは、移動させません
        onClick={(event) => {
          if (longPressedRef.current) event.preventDefault();
        }}
        // 長押しで出る「リンクのプレビュー」を止めます。
        // 出ると、こちらの表示と重なって邪魔になります。
        onContextMenu={(event) => event.preventDefault()}
        // select-none = 長押ししたときに文字が選択されるのを防ぎます
        className="absolute left-1/2 top-1/2 flex w-16 select-none flex-col items-center gap-1"
        style={{
          transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        }}
      >
        {/* 外側の輪。報告がある人だけ光らせます */}
        <div
          className={`relative rounded-full p-[2.5px] ${
            member.hasNews
              ? "bg-gradient-to-tr from-amber-400 via-orange-500 to-pink-500"
              : "bg-stone-200"
          }`}
        >
          <div className="rounded-full bg-white p-[2px]">
            {/* アイコンは <img> ではなく背景画像で置いています。
                <img> は読み込みに失敗すると「壊れた画像」の印が出ますが、
                背景画像なら何も出ず、下の灰色がそのまま残ります。 */}
            <div
              className="h-12 w-12 rounded-full bg-stone-300 bg-cover bg-center"
              style={
                member.avatarUrl
                  ? { backgroundImage: `url("${encodeURI(member.avatarUrl)}")` }
                  : undefined
              }
            />
          </div>

          {/* 気持ちの印 */}
          {/* 気持ちの印。顔にかぶらないよう、輪の外へ少し逃がしています */}
          {mood ? (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[8px] shadow-sm">
              {mood.emoji}
            </span>
          ) : null}
        </div>

        {/* 名前。truncate = 長いときは「…」で切る */}
        <span
          className={`w-full truncate text-center text-[10px] leading-tight ${
            member.hasNews ? "font-bold text-stone-700" : "text-stone-400"
          }`}
        >
          {member.displayName ?? "名無し"}
        </span>
      </Link>

      {/* ▼ 長押しで出る小さなプロフィール */}
      {isOpen ? (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-8"
        >
          {/* stopPropagation = ここを押したときに、背景の「閉じる」を動かさない */}
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-[16rem] rounded-2xl bg-white p-5 text-center shadow-xl"
          >
            <div
              className="mx-auto h-20 w-20 rounded-full bg-stone-200 bg-cover bg-center"
              style={
                member.avatarUrl
                  ? { backgroundImage: `url("${encodeURI(member.avatarUrl)}")` }
                  : undefined
              }
            />

            <p className="mt-3 truncate text-lg font-bold text-stone-800">
              {member.displayName ?? "名無し"}
            </p>

            {mood ? (
              <p className="mt-1 text-xs text-stone-600">
                {mood.emoji} {mood.label}
              </p>
            ) : null}

            <Link
              href={`/members/${member.id}/profile`}
              className="mt-4 block rounded-full bg-stone-800 py-2.5 text-xs font-bold text-white"
            >
              プロフィールを見る
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
