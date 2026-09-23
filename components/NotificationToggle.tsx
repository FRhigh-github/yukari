// 上のバーの右にある、通知のオン・オフを切り替える鐘です。
//
// いまは見た目の切り替えだけです（実際の通知はまだ送っていません）。
// 押すたびに、オン（鐘）とオフ（斜線の入った鐘）が入れかわります。
//
// アイコンは下タブ（BottomNav.tsx）と同じ描き方にそろえています。
//   24×24 の枠 / 線の太さ 2 / 線の端と角は丸く / 塗りなし

"use client";

import { useState } from "react";

type NotificationToggleProps = {
  // 今日の報告があるか。オンのときだけ、鐘の右上に紅い点を出します
  hasNews: boolean;
};

export default function NotificationToggle({ hasNews }: NotificationToggleProps) {
  const [isOn, setIsOn] = useState(true);

  return (
    <button
      type="button"
      onClick={() => setIsOn(!isOn)}
      // 読み上げ用の名前。今の状態と、押すとどうなるかが分かるようにします
      aria-label={isOn ? "通知をオフにする" : "通知をオンにする"}
      aria-pressed={isOn}
      // h-11 w-11 = 44px。押せる範囲を iOS の基準に合わせています
      className={`relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center ${
        isOn ? "text-beni" : "text-stone-400"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 鐘の本体と、下のふち */}
        <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
        {/* 鐘の下の、鳴らす部分 */}
        <path d="M10 21h4" />
        {/* オフのときだけ、斜めの線を引きます */}
        {isOn ? null : <path d="M4 4l16 16" />}
      </svg>

      {/* 報告がある日は、鐘の右上に紅い点。オフのときは出しません */}
      {isOn && hasNews ? (
        <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-beni" />
      ) : null}
    </button>
  );
}
