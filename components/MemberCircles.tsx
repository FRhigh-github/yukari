// ホーム画面に、メンバーのマルを散らして置く部品です。
// 最近ご報告をした人のマルは、まわりが光ります。
// マルを押すと、その人のご報告を見る画面へ移動します。

import Link from "next/link";
import type { Member } from "@/lib/home";

type MemberCirclesProps = {
  members: Member[];
};

// 「2人ずつ横に並べて、下へ積む」形です。
// 位置は px ではなく % で指定して、画面の高さぶんに割り振ります。
// こうすると人数が増えても縦に伸びず、1画面に収まります。

// 左右の位置(%)。行ごとに少しずらして、揃いすぎないようにしています。
const getLeft = (index: number) => {
  const row = Math.floor(index / 2);
  const isLeftSide = index % 2 === 0;

  if (isLeftSide) {
    return row % 2 === 0 ? 28 : 36;
  }
  return row % 2 === 0 ? 72 : 64;
};

// 上からの位置(%)。行の「まん中」に置きたいので、0.5 を足しています。
// 例: 3行なら 16.7% / 50% / 83.3% になります。
const getTop = (index: number, rowCount: number) => {
  const row = Math.floor(index / 2);
  return ((row + 0.5) / rowCount) * 100;
};

export default function MemberCircles({ members }: MemberCirclesProps) {
  const rowCount = Math.ceil(members.length / 2);

  return (
    // h-full = 親からもらった高さいっぱい。
    // relative = 中の要素を「この箱の中での位置」で置けるようにする指定
    <div className="relative h-full w-full">
      {members.map((member, index) => (
        <Link
          key={member.id}
          href={`/members/${member.id}`}
          // absolute = 上の relative の箱の中で、位置を指定して置く
          // -translate-x-1/2 -translate-y-1/2 = マルの中心を、指定した場所に合わせる
          className="absolute flex w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
          style={{
            left: `${getLeft(index)}%`,
            top: `${getTop(index, rowCount)}%`,
          }}
        >
          {/* 外側の輪。光らせるかどうかを、ここで切り替えます */}
          <div
            className={`rounded-full p-[2.5px] ${
              member.hasNews
                ? "bg-gradient-to-tr from-amber-400 via-orange-500 to-pink-500"
                : "bg-stone-200"
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
          </div>

          {/* 名前。truncate = 長いときは「…」で切る */}
          <span
            className={`w-full truncate text-center text-[10px] leading-tight ${
              member.hasNews ? "font-bold text-stone-700" : "text-stone-400"
            }`}
          >
            {member.displayName ?? "名無し"}
          </span>
        </Link>
      ))}
    </div>
  );
}
