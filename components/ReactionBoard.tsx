// 報告に届いた手書きのお祝いを、少しずつ傾けて重ねて並べる部品です。
// 写真の下から、手紙が数枚はさまっているように見せます。
// 押すと、全部を大きく見られます。

"use client";

import { useState } from "react";

export type Reaction = {
  id: string;
  imageUrl: string | null;
  authorName: string | null;
};

type ReactionBoardProps = {
  reactions: Reaction[];
};

// 重ねて出す枚数。これを超えたぶんは「+3」のようにまとめます。
const VISIBLE_COUNT = 3;

// 1枚ずつの傾き。順番に使い回すので、何枚でも同じ見た目になります。
// 毎回ランダムにすると、開くたびに位置が変わって落ち着きません。
const ROTATIONS = [-6, 4, -3];

export default function ReactionBoard({ reactions }: ReactionBoardProps) {
  const [isOpen, setIsOpen] = useState(false);

  // 1枚も無いときは、行ごと出しません
  if (reactions.length === 0) return null;

  const visible = reactions.slice(0, VISIBLE_COUNT);
  const restCount = reactions.length - visible.length;

  return (
    <>
      {/* ▼ 重なった束。
          傾けて重ねると1枚ずつは押しにくいので、
          束ぜんぶで1つのボタンにしています。 */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`お祝い ${reactions.length}件を見る`}
        // -mt-4 = 少し上に食い込ませて、写真の下からのぞいているように見せます
        className="-mt-4 mb-2 flex items-end pl-2"
      >
        {visible.map((reaction, index) => (
          <div
            key={reaction.id}
            // 2枚目からは左へ食い込ませて重ねます。
            // zIndex は左のほうが大きい＝左が手前。
            // 一番左（最新）だけが全部見える形になります。
            className={`bg-white p-1 shadow-md ${index === 0 ? "" : "-ml-5"}`}
            style={{
              transform: `rotate(${ROTATIONS[index % ROTATIONS.length]}deg)`,
              zIndex: visible.length - index,
            }}
          >
            <div
              className="h-14 w-14 bg-white bg-contain bg-center bg-no-repeat"
              style={
                reaction.imageUrl
                  ? { backgroundImage: `url("${encodeURI(reaction.imageUrl)}")` }
                  : undefined
              }
            />
            {/* 名前は一番手前の1枚だけ。全部に出すと重なって読めません */}
            {index === 0 ? (
              <p className="w-14 truncate text-center text-xs text-stone-500">
                {reaction.authorName ?? "名無し"}
              </p>
            ) : null}
          </div>
        ))}

        {/* あふれたぶんの枚数 */}
        {restCount > 0 ? (
          <div className="-ml-5 flex h-16 w-14 items-center justify-center bg-white p-1 text-xs font-bold text-stone-500 shadow-md">
            +{restCount}
          </div>
        ) : null}
      </button>

      {/* ▼ 拡大表示
          fixed inset-0 = 画面全体をおおう。
          z-50 で一番手前に出します。 */}
      {isOpen ? (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/70 p-6"
        >
          <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-10">
            {reactions.map((reaction) => (
              <div key={reaction.id} className="bg-white p-2 shadow-xl">
                <div
                  className="h-56 w-56 bg-white bg-contain bg-center bg-no-repeat"
                  style={
                    reaction.imageUrl
                      ? {
                          backgroundImage: `url("${encodeURI(reaction.imageUrl)}")`,
                        }
                      : undefined
                  }
                />
                <p className="mt-1 text-center text-xs text-stone-500">
                  {reaction.authorName ?? "名無し"}
                </p>
              </div>
            ))}

            <p className="text-xs text-white/70">どこかを押すと閉じます</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
