// アイコンにする写真を、好きな位置・大きさで切り取る画面です。
// プロフィールのアイコンと、グループのアイコンの両方で使います。
//
//   指でなぞる        … 写真を動かす
//   下のつまみ        … 拡大・縮小
//   「決定」          … 枠の中だけを、正方形の画像にして返します
//
// 写真を選んだあと、画面いっぱいにかぶせて出します。

"use client";

import { useRef, useState } from "react";

// 画面に出す切り取り枠の大きさ（px）
const FRAME = 280;
// できあがる画像の大きさ（px）。アイコンは小さく出すので、これで十分です
const OUTPUT = 512;
// どこまで拡大できるか
const MAX_ZOOM = 4;

type ImageCropperProps = {
  file: File;
  // true なら枠を丸く見せます（人のアイコン）。false なら角丸の四角（グループ）
  round: boolean;
  onDone: (blob: Blob) => void;
  onCancel: () => void;
};

export default function ImageCropper({ file, round, onDone, onCancel }: ImageCropperProps) {
  // 選んだファイルを、その場で表示できるURLにします。
  // 描き直しのたびに作り直さないよう、最初の1回だけ作ります
  const [src] = useState(() => URL.createObjectURL(file));
  // 写真のもとの大きさ。読み込み終わるまで分からないので、最初は null
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  // 写真の真ん中が、枠の真ん中からどれだけずれているか（px）
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isWorking, setIsWorking] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  // 前回の指の位置。動いた量を出すのに使います
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // 倍率 1 のとき、写真の短いほうの辺が、ちょうど枠いっぱいになる大きさにします
  const baseScale = natural ? FRAME / Math.min(natural.width, natural.height) : 1;
  const shownWidth = (natural?.width ?? 0) * baseScale * zoom;
  const shownHeight = (natural?.height ?? 0) * baseScale * zoom;

  // 写真が枠からはみ出して、すき間ができないように、動かせる量を制限します
  const clamp = (next: { x: number; y: number }, width: number, height: number) => {
    const maxX = Math.max(0, (width - FRAME) / 2);
    const maxY = Math.max(0, (height - FRAME) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  };

  const handleZoom = (nextZoom: number) => {
    setZoom(nextZoom);
    // 縮めたときに端がすき間にならないよう、位置も収め直します
    setOffset(
      clamp(
        offset,
        (natural?.width ?? 0) * baseScale * nextZoom,
        (natural?.height ?? 0) * baseScale * nextZoom,
      ),
    );
  };

  const handleDone = async () => {
    const image = imgRef.current;
    if (image === null || natural === null) return;
    setIsWorking(true);

    // ▼ 画面の枠（FRAME）を、できあがりの大きさ（OUTPUT）に引き伸ばして描き直します。
    //   画面で見えていたのと同じ位置関係のまま、枠の中だけが残ります。
    const ratio = OUTPUT / FRAME;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (ctx === null) {
      setIsWorking(false);
      return;
    }
    const width = shownWidth * ratio;
    const height = shownHeight * ratio;
    ctx.drawImage(
      image,
      (OUTPUT - width) / 2 + offset.x * ratio,
      (OUTPUT - height) / 2 + offset.y * ratio,
      width,
      height,
    );

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.85);
    });
    setIsWorking(false);
    if (blob) onDone(blob);
  };

  return (
    // 画面いっぱいにかぶせます。z-50 で下タブより手前に出します
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/90 px-4">
      <p className="text-sm text-white/80">指で動かして、位置を合わせてください</p>

      {/* ▼ 切り取り枠。touch-none = 指の動きで画面がスクロールしないようにします */}
      <div
        className={`relative touch-none overflow-hidden bg-stone-800 ring-2 ring-kin ${
          round ? "rounded-full" : "rounded-3xl"
        }`}
        style={{ width: FRAME, height: FRAME }}
        onPointerDown={(event) => {
          // 指が枠の外へ出ても、動きを受け取り続けるための命令
          event.currentTarget.setPointerCapture(event.pointerId);
          lastPointRef.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          const last = lastPointRef.current;
          if (last === null) return;
          setOffset(
            clamp(
              { x: offset.x + event.clientX - last.x, y: offset.y + event.clientY - last.y },
              shownWidth,
              shownHeight,
            ),
          );
          lastPointRef.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={() => {
          lastPointRef.current = null;
        }}
        onPointerCancel={() => {
          lastPointRef.current = null;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          onLoad={(event) =>
            setNatural({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }
          // 真ん中に置いてから、ずらした分だけ動かします
          className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
          style={{
            width: shownWidth,
            height: shownHeight,
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
          }}
        />
      </div>

      {/* 拡大・縮小のつまみ */}
      <input
        type="range"
        min={1}
        max={MAX_ZOOM}
        step={0.01}
        value={zoom}
        onChange={(event) => handleZoom(Number(event.target.value))}
        aria-label="拡大・縮小"
        className="w-[280px] accent-[#c2a14d]"
      />

      <div className="flex w-[280px] gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-12 flex-1 cursor-pointer rounded-xl border border-white/40 text-sm text-white"
        >
          やめる
        </button>
        <button
          type="button"
          onClick={handleDone}
          disabled={natural === null || isWorking}
          className="h-12 flex-[2] cursor-pointer rounded-xl bg-beni text-sm font-bold text-white disabled:opacity-50"
        >
          決定
        </button>
      </div>
    </div>
  );
}
