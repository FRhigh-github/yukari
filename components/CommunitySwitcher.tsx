// 画面の一番上で、見るコミュニティを切り替える部品です。
//
// 選ぶとURLが変わります（例: /?c=xxxx）。
// 「今どれを選んでいるか」を URL に持たせておくと、
// その URL を開き直したときに同じ状態に戻ります。

"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type Community = {
  id: string;
  name: string;
};

type CommunitySwitcherProps = {
  communities: Community[];
  // 今選んでいるコミュニティのid。「すべて」のときは null。
  selectedId: string | null;
};

export default function CommunitySwitcher({
  communities,
  selectedId,
}: CommunitySwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const selected = communities.find((community) => community.id === selectedId);
  const currentName = selected?.name ?? "すべてのコミュニティ";

  const handleSelect = (id: string | null) => {
    setIsOpen(false);
    router.push(id === null ? "/" : `/?c=${id}`);
  };

  return (
    <>
      {/* 押せることが分かるように、枠のあるチップにしています */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex max-w-[16rem] items-center gap-1.5 rounded-full bg-stone-100 py-1.5 pl-3 pr-2.5 text-sm text-stone-700"
      >
        <span className="truncate">{currentName}</span>
        <span className="shrink-0 text-[10px] text-stone-400">▼</span>
      </button>

      {isOpen ? (
        // 背景。押すと閉じます
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 bg-black/40"
        >
          {/* ▼ 下から出るシート
              stopPropagation = ここを押したときに、
              背景の「閉じる」が動かないようにする指定です。 */}
          <div
            onClick={(event) => event.stopPropagation()}
            className="absolute bottom-0 left-1/2 w-full max-w-sm -translate-x-1/2 rounded-t-2xl bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2"
          >
            {/* つまみ。下から出てきたものだと分かる目印です */}
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-200" />

            <ul className="max-h-[50vh] overflow-y-auto overscroll-contain">
              <li>
                <SheetRow
                  label="すべてのコミュニティ"
                  isSelected={selectedId === null}
                  onClick={() => handleSelect(null)}
                />
              </li>

              {communities.map((community) => (
                <li key={community.id}>
                  <SheetRow
                    label={community.name}
                    isSelected={community.id === selectedId}
                    onClick={() => handleSelect(community.id)}
                  />
                </li>
              ))}
            </ul>

            {/* 作る・参加する への入口も、同じ場所に置きます。
                切り替えのために開いたついでに操作できるほうが早いためです。 */}
            <div className="mt-2 border-t border-stone-100 pt-2">
              <Link
                href="/communities?open=create"
                className="flex h-12 items-center px-5 text-sm text-stone-600"
              >
                ＋ 新しく作る
              </Link>
              <Link
                href="/communities?open=join"
                className="flex h-12 items-center px-5 text-sm text-stone-600"
              >
                招待コードで参加する
              </Link>
              <Link
                href="/communities"
                className="flex h-12 items-center px-5 text-sm text-stone-600"
              >
                コミュニティの設定
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// シートの1行。高さ48pxで、iOS の「44px以上」を満たしています。
type SheetRowProps = {
  label: string;
  isSelected: boolean;
  onClick: () => void;
};

function SheetRow({ label, isSelected, onClick }: SheetRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 w-full items-center justify-between px-5 text-left text-sm ${
        isSelected ? "font-bold text-stone-900" : "text-stone-600"
      }`}
    >
      <span className="truncate">{label}</span>
      {isSelected ? <span className="text-orange-500">✓</span> : null}
    </button>
  );
}
