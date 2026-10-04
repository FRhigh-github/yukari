// アイコンにする写真を、好きな位置・大きさで切り取る画面です。
// プロフィールのアイコンと、グループのアイコンの両方で使います。
//
//   指でなぞる        … 写真を動かす
//   2本指でつまむ     … 拡大・縮小（下のつまみでもできます）
//   「決定」          … 枠の中だけを、正方形の画像にして返します
//
// 写真を選んだあと、画面いっぱいにかぶせて出します。
//
// ▼ 動かす・つまむと、枠からはみ出さないように収める計算は、
//   react-easy-crop というライブラリに任せています。
//   前は指1本で動かす処理と、はみ出さない計算を自分で書いていて、
//   2本指での拡大ができず、途中で打ち切られた操作も受け取れませんでした。

"use client";

import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

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
  // 枠の真ん中から、写真がどれだけずれているか（ライブラリが決めます）
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  // 枠の中に見えている範囲を、もとの写真の上の位置と大きさ（px）で表したもの。
  // 写真を読み込み終わるまでは分からないので、最初は null
  const [area, setArea] = useState<Area | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const handleDone = async () => {
    if (area === null) return;
    setIsWorking(true);
    try {
      // もとの写真を読み込み直して、枠の中に見えていた範囲だけを OUTPUT の大きさに描きます
      const image = new Image();
      image.src = src;
      await image.decode();

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext("2d");
      if (ctx === null) throw new Error("画像の変換に失敗しました");
      ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, OUTPUT, OUTPUT);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.85);
      });
      if (blob) onDone(blob);
    } catch (error) {
      // 読み込めない写真だったときは、何もせずに戻します（原因は開発者向けに残します）
      console.error("写真を切り取れませんでした", error);
    }
    setIsWorking(false);
  };

  return (
    // 画面いっぱいにかぶせます。z-50 で下タブより手前に出します
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/90 px-4">

      {/* ▼ 切り取り枠。touch-none = 指の動きで画面がスクロールしないようにします。
          丸い枠（人のアイコン）は、この外枠を丸く切り抜いて見せます */}
      <div
        className={`relative touch-none overflow-hidden bg-stone-800 ring-2 ring-kin ${
          round ? "rounded-full" : "rounded-3xl"
        }`}
        style={{ width: FRAME, height: FRAME }}
      >
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          maxZoom={MAX_ZOOM}
          // 1 = 正方形に切り取ります
          aspect={1}
          // 切り取る範囲を、この枠いっぱいにします
          cropSize={{ width: FRAME, height: FRAME }}
          // cover = 倍率 1 のとき、写真の短いほうの辺が、ちょうど枠いっぱいになる大きさにします
          objectFit="cover"
          showGrid={false}
          // 枠の線と、枠の外を暗くする影は、外枠（ring-kin と丸い切り抜き）で見せるので消します
          style={{ cropAreaStyle: { border: "none", boxShadow: "none" } }}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, pixels) => setArea(pixels)}
        />
      </div>

      {/* 拡大・縮小のつまみ */}
      <input
        type="range"
        min={1}
        max={MAX_ZOOM}
        step={0.01}
        value={zoom}
        onChange={(event) => setZoom(Number(event.target.value))}
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
          disabled={area === null || isWorking}
          className="h-12 flex-[2] cursor-pointer rounded-xl bg-beni text-sm font-bold text-white disabled:opacity-50"
        >
          決定
        </button>
      </div>
    </div>
  );
}
