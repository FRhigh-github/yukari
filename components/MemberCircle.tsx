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
import { createPortal } from "react-dom";
import { MOODS, SHOW_MOOD_ON_HOME } from "@/lib/mood";
import type { Member } from "@/lib/home";
import MoodIcon from "@/components/MoodIcon";

// これだけ押し続けたら長押し（ミリ秒）
const LONG_PRESS = 500;

type MemberCircleProps = {
  member: Member;
  x: number;
  y: number;
  // 名前を出さないとき true。
  // 水引の輪の中に置くと、名前が紐に重なって読めなくなるためです。
  hideName?: boolean;
};

export default function MemberCircle({
  member,
  x,
  y,
  hideName,
}: MemberCircleProps) {
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
        // ?view=story = 一覧を挟まずに、いきなり全画面のストーリーで開きます
        href={`/members/${member.id}?view=story`}
        // ▼ 光っている人（まだ見ていない新しいご報告がある人）だけ、ご報告の中身まで先に取っておきます。
        //   押される見込みが高いのはこの人たちなので、押した瞬間に開くようにします。
        //   前は全員ぶん中身まで取っていたので、ホームを開くたびに通信が30件ほど走り、
        //   会場の Wi-Fi のように回線が弱いと、最初の操作がもたつくおそれがありました。
        //   "auto" = ほかの人は、画面の「枠」（待ち画面まで）だけを先に取ります。
        //   一度取ったものは3分間使い回します（next.config.ts の staleTimes）。
        //   （先読みは本番のときだけ動きます。npm run dev では動きません）
        prefetch={member.hasNews ? true : "auto"}
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerMove={(event) => {
          // 長押しでプロフィールを出したあとは、指を動かしても後ろの相関図を動かしません
          // （出ているプロフィールの裏で、模様だけが勝手にずれていくのを防ぎます）
          if (longPressedRef.current) event.stopPropagation();
          cancel();
        }}
        // 長押ししたまま動かしたときに、リンクをつまんで運ぶ動き（ドラッグ）を始めないようにします
        draggable={false}
        // 長押しで開いたときは、移動させません
        onClick={(event) => {
          if (longPressedRef.current) event.preventDefault();
        }}
        // 長押しで出る「リンクのプレビュー」を止めます。
        // 出ると、こちらの表示と重なって邪魔になります。
        onContextMenu={(event) => event.preventDefault()}
        // select-none  = 長押ししたときに文字が選択されるのを防ぎます
        // no-callout   = iPhone のリンクプレビューを止めます（globals.css）
        className="no-callout absolute left-1/2 top-1/2 flex w-16 select-none flex-col items-center gap-1"
        style={{
          transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        }}
      >
        {/* 外側の輪。報告がある人だけ光らせます */}
        <div
          className={`relative rounded-full p-[2.5px] ${
            // 報告がある人は、水引の紅から金へのグラデーションの輪。ない人は、控えめな金の細い輪
            // via-kin via-45% = 真ん中あたりで、もう金になるようにします（紅と金の半々に見えるように）
            member.hasNews ? "bg-gradient-to-tr from-beni via-kin via-45% to-[#e3c77f]" : "bg-kin/40"
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

          {/* 気持ち（ステータス）の印。顔にかぶらないよう、輪の外へ少し逃がしています。
              SHOW_MOOD_ON_HOME が false のあいだは出しません（lib/mood.ts）。
              h-5 w-5 = 20px。前の 16px では、相関図の上では小さくて見分けにくかったため */}
          {SHOW_MOOD_ON_HOME && mood ? (
            <span
              aria-label={mood.label}
              className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-kin/40"
            >
              <MoodIcon value={mood.value} className="h-3.5 w-3.5" />
            </span>
          ) : null}

          {/* ▼ 「最後に話したのは何年前」の印。
                1年以上やりとりが無い人にだけ「3年」のように付けます。
                全員に付けると印だらけになるので、ごぶさたの人だけが目に入るようにしています。
                数えているのは DB です（カード・お祝い・チャットを送ると記録されます） */}
          {member.lastContactYears !== null && member.lastContactYears >= 1 ? (
            <span className="absolute -right-2 -top-1 rounded-full bg-white px-1.5 text-[11px] font-bold leading-4 text-stone-500 shadow-sm ring-1 ring-kin/60">
              {member.lastContactYears}年
            </span>
          ) : null}
        </div>

        {/* 名前。truncate = 長いときは「…」で切る */}
        {hideName ? null : (
        <span
          className={`w-full truncate text-center text-xs leading-tight ${
            member.hasNews ? "font-bold text-stone-700" : "text-stone-400"
          }`}
        >
          {member.displayName ?? "名無し"}
        </span>
        )}
      </Link>

      {/* ▼ 長押しで出る小さなプロフィール
            createPortal = この部品の中ではなく、ページのいちばん外側（body）に描く命令です。
            このマルは、拡大・縮小・移動をかけた枠（MemberCircles）の中にあります。
            その中に置くと、fixed でも画面ではなく枠が基準になってしまい、
            プロフィールがずれたり縮んだりして、上のバーやボタンも暗くなりませんでした。
            （isOpen は押したあとにしか true にならないので、document はブラウザの中でだけ使います） */}
      {isOpen ? createPortal(
        <div
          onClick={() => setIsOpen(false)}
          // 外側（MemberCircles）の「指で動かす」処理に、ここでの操作を伝えません。
          // portal で外に描いても、React の中では親子のままなので、止めないと後ろの模様が動きます
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
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
              <p className="mt-1 flex items-center justify-center gap-1 text-sm text-stone-600">
                <MoodIcon value={mood.value} className="h-4 w-4" />
                {mood.label}
              </p>
            ) : null}

            {/* 最後にやりとりした時。まだ一度も無ければ、そう出します */}
            <p className="mt-2 text-sm text-stone-500">
              {member.lastContactLabel === null ? (
                "まだやりとりはありません"
              ) : (
                <>
                  最後のやりとり{" "}
                  <span className="font-bold text-kin">{member.lastContactLabel}</span>
                </>
              )}
            </p>

            <Link
              href={`/members/${member.id}/profile`}
              className="mt-4 block rounded-full bg-beni py-2.5 text-xs font-bold text-white"
            >
              プロフィールを見る
            </Link>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
