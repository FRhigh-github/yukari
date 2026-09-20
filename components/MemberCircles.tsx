// ホーム画面に、メンバーのマルを散らして置く部品です。
// 最近ご報告をした人のマルは、まわりが光ります。
// マルを押すと、その人のご報告を見る画面へ移動します。

import Link from "next/link";
import type { Member } from "@/lib/home";

type MemberCirclesProps = {
  members: Member[];
};

// 置き場所は表で持たず、計算で出します。表だと人数が増えたときに
// あふれたぶんが同じ場所に重なるためです。
// 考え方は「2人ずつ横に並べて、下へ積んでいく」。
// 左右を行ごとに少しずらして、揃いすぎないようにしています。

const ROW_HEIGHT = 120;   // 1行あたりの高さ(px)
const TOP_MARGIN = 45;    // 一番上の余白(px)

// 左右の位置(%)。row が偶数の行と奇数の行で、少しずらします。
const getLeft = (index: number) => {
  const row = Math.floor(index / 2);
  const isLeftSide = index % 2 === 0;

  if (isLeftSide) {
    return row % 2 === 0 ? 27 : 35;
  }
  return row % 2 === 0 ? 71 : 63;
};

const getTop = (index: number) => {
  const row = Math.floor(index / 2);
  return TOP_MARGIN + row * ROW_HEIGHT;
};

export default function MemberCircles({ members }: MemberCirclesProps) {
  // 人数から高さを出します。これが無いと下のマルがはみ出して見えなくなります。
  const rowCount = Math.ceil(members.length / 2);
  const areaHeight = TOP_MARGIN + rowCount * ROW_HEIGHT + 60;

  return (
    // relative = 中の要素を「この箱の中での位置」で置けるようにする指定
    <div className="relative w-full" style={{ height: `${areaHeight}px` }}>
      {members.map((member, index) => (
        <Link
          key={member.id}
          href={`/members/${member.id}`}
          // absolute = 上の relative の箱の中で、位置を指定して置く
          // -translate-x-1/2 = マルの中心が、指定した場所に来るようにずらす
          className="absolute flex w-16 -translate-x-1/2 flex-col items-center gap-1"
          style={{ left: `${getLeft(index)}%`, top: `${getTop(index)}px` }}
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
