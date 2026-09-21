// 上から引っぱると、くるくるが出てきて中身を取り直す仕組みです。
// Instagram などと同じ操作です。
//
// 一度見た画面は30秒ほど覚えておく設定にしてあるので（next.config.ts）、
// 他の人が今ご報告したものは、すぐには出てきません。
// これを引っぱると、覚えている中身を捨てて取り直します。

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// これ以上引っぱったら、指を離したときに取り直す（px）
const THRESHOLD = 70;

// 引っぱれる上限。いくらでも伸びると気持ち悪いので止めます（px）
const MAX = 100;

type PullToRefreshProps = {
  children: React.ReactNode;
};

export default function PullToRefresh({ children }: PullToRefreshProps) {
  const router = useRouter();

  // 指を置き始めた縦位置。null なら引っぱっていません。
  const startRef = useRef<number | null>(null);

  // 今どれだけ引っぱられているか（px）
  const [pull, setPull] = useState(0);

  // 指が触れている最中か。
  // （startRef は描画中に読めない決まりなので、こちらを使います）
  const [isDragging, setIsDragging] = useState(false);

  // 取り直している最中か
  const [isRefreshing, setIsRefreshing] = useState(false);

  // pointer は、指とマウスのどちらでも同じように扱える仕組みです。
  // touch だけにすると、PCで確かめられません。
  const handlePointerDown = (event: React.PointerEvent) => {
    if (isRefreshing) return;

    // ※ ここで setPointerCapture（指の動きを枠が独り占めする指定）は使いません。
    //   使うと、中にあるマルやリンクのタップまで枠に吸われて、
    //   押しても何も起きなくなります。
    startRef.current = event.clientY;
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (startRef.current === null) return;

    const distance = event.clientY - startRef.current;

    // 下に引っぱったときだけ反応します
    if (distance <= 0) {
      setPull(0);
      return;
    }

    // 指の動きより少なく動かします。
    // 同じだけ動くと軽すぎて、ゴムを引っぱっている感じが出ません。
    setPull(Math.min(distance * 0.5, MAX));
  };

  const handlePointerUp = () => {
    startRef.current = null;
    setIsDragging(false);

    // 足りなければ、そのまま戻すだけ
    if (pull < THRESHOLD) {
      setPull(0);
      return;
    }

    setIsRefreshing(true);
    // くるくるが見える位置で止めておきます
    setPull(THRESHOLD);

    // refresh() は「取り直して」と頼むだけで、
    // いつ終わったかは教えてくれません。0.8秒ぶんだけ回して戻します。
    setTimeout(() => {
      setIsRefreshing(false);
      setPull(0);
    }, 800);

    router.refresh();
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative h-full overflow-hidden"
    >
      {/* ▼ くるくる。引っぱったぶんだけ下りてきます */}
      <div
        className="absolute left-1/2 z-10 -translate-x-1/2"
        style={{
          top: `${pull - 30}px`,
          opacity: Math.min(pull / THRESHOLD, 1),
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-stone-400 ${isRefreshing ? "animate-spin" : ""}`}
          style={
            // 取り直し中は自分で回るので、引っぱりぶんの回転はやめます
            isRefreshing
              ? undefined
              : { transform: `rotate(${pull * 3}deg)` }
          }
        >
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 4v5h-5" />
        </svg>
      </div>

      {/* ▼ 中身。引っぱったぶんだけ下がります */}
      <div
        className="h-full"
        style={{
          transform: `translateY(${pull}px)`,
          // 指を離したあとだけ、なめらかに戻します。
          // 引っぱっている最中に付けると、指に遅れてついてきます。
          transition: isDragging ? "none" : "transform 0.2s",
        }}
      >
        {children}
      </div>
    </div>
  );
}
