// 横に並んだものを、左右のボタンで送れるようにする入れ物です。
//
// スクロールバーを消したので、PCだと「まだ横に続いている」ことが
// 分からなくなります。その代わりのボタンです。
// 端まで来たらボタンは消えるので、続きがあるかどうかも分かります。

"use client";

import { useRef, useState } from "react";

type HorizontalScrollerProps = {
  children: React.ReactNode;
  className?: string;
};

export default function HorizontalScroller({
  children,
  className = "",
}: HorizontalScrollerProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const [canGoLeft, setCanGoLeft] = useState(false);
  const [canGoRight, setCanGoRight] = useState(true);

  // 今どこまで動いているかを見て、ボタンを出すか決めます。
  //   scrollLeft   = 左からどれだけ動いたか
  //   scrollWidth  = 中身の全体の長さ
  //   clientWidth  = 見えている幅
  const updateButtons = () => {
    const list = listRef.current;
    if (list === null) return;

    setCanGoLeft(list.scrollLeft > 4);
    // 4 は誤差のぶんの余裕。ぴったり比べると、端で出たり消えたりします。
    setCanGoRight(list.scrollLeft + list.clientWidth < list.scrollWidth - 4);
  };

  const scrollBy = (direction: 1 | -1) => {
    const list = listRef.current;
    if (list === null) return;

    // 見えている幅の7割ずつ送ります。全部送ると、どこまで見たか分からなくなります。
    list.scrollBy({ left: direction * list.clientWidth * 0.7, behavior: "smooth" });
  };

  return (
    <div className={`relative ${className}`}>
      <div
        ref={listRef}
        onScroll={updateButtons}
        className="flex gap-2 overflow-x-auto"
      >
        {children}
      </div>

      {canGoLeft ? (
        <ArrowButton side="left" onClick={() => scrollBy(-1)} />
      ) : null}
      {canGoRight ? (
        <ArrowButton side="right" onClick={() => scrollBy(1)} />
      ) : null}
    </div>
  );
}

type ArrowButtonProps = {
  side: "left" | "right";
  onClick: () => void;
};

function ArrowButton({ side, onClick }: ArrowButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "左へ" : "右へ"}
      // -translate-y-1/2 で、縦のまん中に重ねます
      className={`absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-stone-600 shadow-md ${
        side === "left" ? "left-0" : "right-0"
      }`}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}
