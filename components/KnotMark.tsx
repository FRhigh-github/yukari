// 結ばれた紐の印です。ログインやサインアップの画面の上に置きます。
//
// オープニングで描かれるものと同じ形の、完成した状態です。
// 動かす必要がないので、絵を1枚（public/knot.svg）にして置いてあります。
// アニメーションの部品をそのまま持ってくると、
// 画面を開くたびに計算が走るうえ、勝手に動き出してしまいます。

type KnotMarkProps = {
  // 下に添える文字。要らなければ省けます
  caption?: string;
};

export default function KnotMark({ caption }: KnotMarkProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/knot.svg"
        alt="ゆかり"
        width={180}
        height={120}
        // すぐ見えてほしいので、後回しにしません
        loading="eager"
      />

      {caption ? (
        <p className="text-[10px] tracking-[0.22em] text-[#767a72]">
          {caption}
        </p>
      ) : null}
    </div>
  );
}
