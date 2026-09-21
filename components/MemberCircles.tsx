// ホーム画面のマルを、自分を中心にした同心円に並べる部品です。
//
// 中心 = 自分。内側の輪 = 最近ご報告があった人。外側 = それ以外。
// 中心からの距離が、そのまま「疎遠さ」になります。

import Link from "next/link";
import type { Member } from "@/lib/home";

type MemberCirclesProps = {
  members: Member[];
  currentUserId: string;
};

// 輪の設定。中心からの距離(px)と、その輪に入る人数の上限です。
//
// 横は画面幅(384px)に収める必要があるので、狭くしてあります。
// 反対に縦は余っているので、大きめにして縦長の輪にしています。
// 数字を変えれば、そのまま配置が変わります。
//
// ※ radiusY は「一番下に来る人の位置」ではありません。
//   人が真下にちょうど来るとは限らないためです。
//   たとえば6人だと、一番下の人でも radiusY の 0.87倍あたりに止まります。
//   なので、見た目より大きめの数字を入れる必要があります。
const RINGS = [
  { radiusX: 70, radiusY: 150, capacity: 6 },
  { radiusX: 130, radiusY: 320, capacity: 12 },
  // 最後の輪は、あふれた人を全部引き受けます
  { radiusX: 145, radiusY: 330, capacity: Infinity },
];

type Placed = {
  member: Member;
  x: number;
  y: number;
};

// 誰をどこに置くかを計算します。
// 内側から順に埋めていき、いっぱいになったら次の輪へ移ります。
const placeMembers = (members: Member[]): Placed[] => {
  const placed: Placed[] = [];
  let placedCount = 0;

  for (const [ringIndex, ring] of RINGS.entries()) {
    const rest = members.length - placedCount;
    if (rest <= 0) break;

    const count = Math.min(ring.capacity, rest);

    // 輪ごとに半目盛りずらします。
    // そろえると内側と外側が真上で重なって、1本の列に見えてしまうためです。
    const offset = ringIndex % 2 === 0 ? 0 : 0.5;

    for (let i = 0; i < count; i++) {
      // 1周(360度)を人数で割って、等間隔に配ります。
      // Math.PI * 2 が1周ぶん。-Math.PI / 2 は「真上から始める」ための引き算です。
      const angle = ((i + offset) / count) * Math.PI * 2 - Math.PI / 2;

      placed.push({
        member: members[placedCount + i],
        // cos が横、sin が縦の位置を出してくれます
        x: Math.round(Math.cos(angle) * ring.radiusX),
        y: Math.round(Math.sin(angle) * ring.radiusY),
      });
    }

    placedCount += count;
  }

  return placed;
};

export default function MemberCircles({
  members,
  currentUserId,
}: MemberCirclesProps) {
  // 自分は中心に置くので、輪に並べる人たちとは分けます
  const me = members.find((member) => member.id === currentUserId);
  const others = members.filter((member) => member.id !== currentUserId);

  // members は lib/home.ts で「報告がある人が先」に並べ替えてあるので、
  // そのまま内側から詰めると、最近の人ほど中心に近くなります。
  const placed = placeMembers(others);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* ▼ 中心から伸びる線
          線は div を1本の棒として使っています。
          origin-left（回転の軸を左端にする）で、
          中心を軸に回すと放射状の線になります。 */}
      {placed.map(({ member, x, y }) => (
        <div
          key={`line-${member.id}`}
          className="absolute left-1/2 top-1/2 h-px origin-left bg-stone-200"
          style={{
            // hypot = 直角三角形の斜辺の長さ。中心からの距離になります
            width: `${Math.hypot(x, y)}px`,
            // atan2 が角度（ラジアン）を返すので、度に直します
            transform: `rotate(${(Math.atan2(y, x) * 180) / Math.PI}deg)`,
          }}
        />
      ))}

      {/* ▼ 自分（中心） */}
      {me ? (
        <Link
          href={`/members/${currentUserId}`}
          className="absolute left-1/2 top-1/2 flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
        >
          <div className="rounded-full bg-white p-[3px] shadow-md">
            <div
              className="h-14 w-14 rounded-full bg-stone-300 bg-cover bg-center"
              style={
                me.avatarUrl
                  ? { backgroundImage: `url("${encodeURI(me.avatarUrl)}")` }
                  : undefined
              }
            />
          </div>
          <span className="text-[10px] font-bold text-stone-600">自分</span>
        </Link>
      ) : null}

      {/* ▼ まわりのメンバー */}
      {placed.map(({ member, x, y }) => (
        <Link
          key={member.id}
          href={`/members/${member.id}`}
          // 「中心へ移動」してから「計算したぶんずらす」の2段階です
          className="absolute left-1/2 top-1/2 flex w-16 flex-col items-center gap-1"
          style={{
            transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
          }}
        >
          {/* 外側の輪。報告がある人だけ光らせます */}
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
