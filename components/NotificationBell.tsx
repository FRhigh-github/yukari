// 上のバーの右にある鐘です。押すと「お知らせ」が開きます。
//
// お知らせ = いま見ているコミュニティの、新しいご報告（自分のものを除く）です（lib/home.ts の news）。
// まだストーリーで見ていないものには紅い点が付き、鐘の右上にも紅い点が出ます。
// 押すと、そのご報告のストーリーが開きます。
//
// ▼ 前は、押すと鐘に斜線が入るだけの「見た目の切り替え」でした。
//   押しても何も起きないので、使う人から見ると壊れているのと同じでした。
//
// アイコンは下タブ（BottomNav.tsx）と同じ描き方にそろえています。
//   24×24 の枠 / 線の太さ 2 / 線の端と角は丸く / 塗りなし

"use client";

import Link from "next/link";
import { useState } from "react";
import type { NewsItem } from "@/lib/home";

type NotificationBellProps = {
  news: NewsItem[];
};

export default function NotificationBell({ news }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);

  // まだ見ていないお知らせがあるか。あれば鐘の右上に紅い点を出します
  const hasUnseen = news.some((item) => item.isUnseen);

  return (
    // relative = 開いた一覧を、この鐘のすぐ下に出すための基準
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        // 読み上げ用の名前。見ていないお知らせがあるかも伝えます
        aria-label={hasUnseen ? "お知らせ（新しいものがあります）" : "お知らせ"}
        aria-expanded={isOpen}
        // h-11 w-11 = 44px。押せる範囲を iOS の基準に合わせています
        className="relative flex h-11 w-11 cursor-pointer items-center justify-center text-beni"
      >
        <svg
          viewBox="0 0 24 24"
          width="30"
          height="30"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {/* 鐘の本体と、下のふち */}
          <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
          {/* 鐘の下の、鳴らす部分 */}
          <path d="M10 21h4" />
        </svg>

        {hasUnseen ? (
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-beni" />
        ) : null}
      </button>

      {isOpen ? (
        <>
          {/* 一覧の外（画面の残り）を押したら閉じます。
              鐘より後ろ(z-40)に置いて、一覧(z-50)だけを前に出します */}
          <div onClick={() => setIsOpen(false)} className="fixed inset-0 z-40 bg-black/20" />

          {/* right-0 top-full = 鐘の右端にそろえて、すぐ下に出します */}
          <div className="absolute right-0 top-full z-50 mt-2 w-[calc(100vw-2rem)] max-w-[22rem] overflow-hidden rounded-2xl bg-white shadow-xl">
            <p className="border-b border-stone-100 px-4 py-3 text-sm font-bold text-stone-800">
              お知らせ
            </p>

            {news.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-stone-500">
                新しいお知らせはありません
              </p>
            ) : (
              <ul className="max-h-[60vh] overflow-y-auto overscroll-contain">
                {news.map((item) => (
                  <li key={item.postId}>
                    {/* ?post= = そのご報告からストーリーで開きます（MemberPosts） */}
                    <Link
                      href={`/members/${item.authorId}?post=${item.postId}`}
                      onClick={() => setIsOpen(false)}
                      className="flex min-h-16 items-center gap-3 px-4 py-2.5"
                    >
                      {/* アイコンは背景画像で置きます（読み込み失敗時に印が出ないため） */}
                      <span
                        className="h-10 w-10 shrink-0 rounded-full bg-stone-200 bg-cover bg-center ring-1 ring-kin/50"
                        style={
                          item.authorAvatarUrl
                            ? { backgroundImage: `url("${encodeURI(item.authorAvatarUrl)}")` }
                            : undefined
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-stone-800">
                          <span className="font-bold">{item.authorName}</span>さんのご報告
                        </span>
                        <span
                          className={`block truncate text-sm ${
                            item.isUnseen ? "font-bold text-stone-800" : "text-stone-500"
                          }`}
                        >
                          {item.title}
                        </span>
                        <span className="block text-xs text-stone-400">{item.timeLabel}</span>
                      </span>
                      {/* まだ見ていないものだけ、右に紅い点 */}
                      {item.isUnseen ? (
                        <span
                          aria-label="まだ見ていません"
                          className="h-2.5 w-2.5 shrink-0 rounded-full bg-beni"
                        />
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
