// ホーム画面のマルを、自分を中心にした同心円に並べる部品です。
//
// 中心 = 自分。内側の輪 = 最近ご報告があった人。外側 = それ以外。
// 中心からの距離が、そのまま「疎遠さ」になります。
//
// ▼ 並べ方は、蜂の巣と同じ「六角形の並び」です。
//     1つ目の輪 … 6人（真上から 60度ずつ）
//     2つ目の輪 … 6人（1つ目の輪のあいだ、30度ずらした向き）
//     3つ目の輪 … 6人（1つ目の輪と同じ向きで、2倍の距離）
//   こう置くと、となりどうしがどこも同じ距離になり、
//   左右対称の、きっちりした形になります。
//
//   輪の大きさは、画面の幅と高さを測って、いちばん外の輪がちょうど収まるように決めます。
//
// ▼ 線は、水引で作る花（細い輪をいくつも重ねて、花びらにしたもの）にならっています。
//   中心の自分と一人ひとりを、「中心を通る細い輪」で結びます。
//   輪がいくつも重なって、花びらのように見えます。
//   1人につき2本、少し大きさを変えて重ね、何本かの紐を束ねた水引らしさを出しています。
//   色は、中心の近くが紅、外へ行くほど金になるグラデーションです。

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import MemberCircle from "@/components/MemberCircle";
import type { Member } from "@/lib/home";

// 水引の色（globals.css と同じ）
const BENI = "#b7282e";
const KIN = "#c2a14d";

// アイコンの半分の大きさ（px）。輪が画面からはみ出さないように、この分だけ内側に収めます
const ICON_RADIUS = 32;

// 輪の中で埋めていく順番。
// 向かい合う場所どうしを交互に埋めるので、人数が少なくても片寄りません。
// （0 = 真上、そこから時計回りに 1, 2, … 5）
const FILL_ORDER = [0, 3, 1, 4, 2, 5];

// 3つの輪の決まり。
//   distance = 中心からの距離（1つ目の輪を 1 としたとき）
//   angle    = 1人目を置く向き（度）。-90 が真上
const RINGS = [
  { distance: 1, angle: -90 },
  { distance: Math.sqrt(3), angle: -60 },
  { distance: 2, angle: -90 },
];

type MemberCirclesProps = {
  members: Member[];
  currentUserId: string;
};

export default function MemberCircles({
  members,
  currentUserId,
}: MemberCirclesProps) {
  // ▼ 置く範囲の大きさを測って、1つ目の輪の半径（px）を決めます。
  //   大きさは画面に出てからでないと測れないので、最初は 70px で出しておきます。
  const areaRef = useRef<HTMLDivElement>(null);
  const [unit, setUnit] = useState(70);
  const [isListOpen, setIsListOpen] = useState(false);

  useEffect(() => {
    const area = areaRef.current;
    if (area === null) return;

    // ResizeObserver = 大きさが変わるたびに教えてくれる仕組み
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      // いちばん外の輪（距離 2）＋アイコンの半分 が、幅と高さの半分に収まる大きさ
      const fit = (Math.min(width, height) / 2 - ICON_RADIUS) / 2;
      setUnit(Math.max(40, fit));
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  // 自分は中心に置くので、輪に並べる人たちとは分けます
  const me = members.find((member) => member.id === currentUserId);
  const others = members.filter((member) => member.id !== currentUserId);

  // 置ける場所は 6人 × 3つの輪 = 18か所。
  // 入りきらないときは、最後の1か所を「その他」にします
  const capacity = RINGS.length * 6;
  const fitsAll = others.length <= capacity;
  const shown = fitsAll ? others : others.slice(0, capacity - 1);
  const rest = others.slice(shown.length);

  // n番目の場所の位置（中心からの px）
  const spotAt = (n: number) => {
    const ring = RINGS[Math.floor(n / 6)];
    const step = FILL_ORDER[n % 6];
    const angle = ((ring.angle + step * 60) * Math.PI) / 180;
    return {
      x: Math.cos(angle) * ring.distance * unit,
      y: Math.sin(angle) * ring.distance * unit,
    };
  };

  return (
    <div ref={areaRef} className="relative h-full w-full overflow-hidden">
      {/* ▼ 中心から一人ひとりへ伸びる線。アイコンより先に描いて、後ろに回します。
            svg を範囲いっぱいに広げ、中心を真ん中にずらして（translate）描いています。 */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          {/* radialGradient = 中心から外へ向かって色が変わるグラデーション。
              userSpaceOnUse = 位置を px で指定する、という意味です */}
          <radialGradient
            id="cord-gradient"
            gradientUnits="userSpaceOnUse"
            cx="0"
            cy="0"
            r={unit * 2}
          >
            {/* 金を強めに。半分より内側で、もう金に変わります */}
            <stop offset="0%" stopColor={BENI} />
            <stop offset="40%" stopColor={KIN} />
            <stop offset="100%" stopColor="#e3c77f" />
          </radialGradient>
        </defs>
        {/* 50% の位置へずらして、中心を 0,0 にします */}
        <g style={{ transform: "translate(50%, 50%)" }} fill="none">
          {[...shown.map((_, index) => index), ...(rest.length > 0 ? [capacity - 1] : [])].map(
            (n) => {
              const { x, y } = spotAt(n);
              // 中心（0,0）とその人（x,y）を直径の両はしにする円。
              // こうすると、どの輪も中心を通るので、花びらが中心から開いているように見えます
              const radius = Math.hypot(x, y) / 2;
              return (
                <g key={n}>
                  <circle cx={x / 2} cy={y / 2} r={radius} stroke="url(#cord-gradient)" strokeWidth={1.1} opacity={0.8} />
                  {/* 少しだけ大きい輪をもう1本。2本の紐を束ねたように見せます */}
                  <circle cx={x / 2} cy={y / 2} r={radius + 3} stroke="url(#cord-gradient)" strokeWidth={0.8} opacity={0.5} />
                </g>
              );
            },
          )}
        </g>
      </svg>

      {/* ▼ 自分（中心） */}
      {me ? (
        <Link
          href={`/members/${currentUserId}`}
          aria-label="自分"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-kin bg-white p-[3px]"
        >
          <div
            className="h-14 w-14 rounded-full bg-stone-300 bg-cover bg-center"
            style={
              me.avatarUrl
                ? { backgroundImage: `url("${encodeURI(me.avatarUrl)}")` }
                : undefined
            }
          />
        </Link>
      ) : null}

      {/* ▼ まわりのメンバー。
            マル1つぶんの中身は MemberCircle にまとめてあります。
            長押しを受け取るために、ブラウザ側で動く部品にする必要があるためです。 */}
      {shown.map((member, index) => {
        const { x, y } = spotAt(index);
        return (
          <MemberCircle key={member.id} member={member} x={x} y={y} hideName />
        );
      })}

      {/* ▼ 入りきらなかった人。最後の場所に「その他」として置きます */}
      {rest.length > 0 ? (
        <button
          type="button"
          onClick={() => setIsListOpen(true)}
          aria-label={`その他 ${rest.length}人を見る`}
          className="absolute left-1/2 top-1/2 flex h-[57px] w-[57px] cursor-pointer items-center justify-center rounded-full border border-kin bg-white text-sm font-bold text-kin"
          style={{
            transform: `translate(-50%, -50%) translate(${spotAt(capacity - 1).x}px, ${spotAt(capacity - 1).y}px)`,
          }}
        >
          +{rest.length}
        </button>
      ) : null}

      {/* ▼ その他のメンバーの一覧。下からせり上がる板です */}
      {isListOpen ? (
        <div
          onClick={() => setIsListOpen(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
        >
          {/* stopPropagation = 板の中を押したときに、背景の「閉じる」を動かさない */}
          <div
            onClick={(event) => event.stopPropagation()}
            className="max-h-[70vh] w-full max-w-[430px] overflow-y-auto rounded-t-2xl bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3"
          >
            {/* 上の小さな棒。「引き出した板」だと分かるようにする目印です */}
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-200" />

            <p className="mb-2 text-sm font-bold text-stone-700">
              その他のメンバー（{rest.length}人）
            </p>

            <ul>
              {rest.map((member) => (
                <li key={member.id}>
                  <Link
                    href={`/members/${member.id}`}
                    className="flex h-14 items-center gap-3"
                  >
                    <span
                      className="h-10 w-10 shrink-0 rounded-full bg-stone-200 bg-cover bg-center"
                      style={
                        member.avatarUrl
                          ? { backgroundImage: `url("${encodeURI(member.avatarUrl)}")` }
                          : undefined
                      }
                    />
                    <span className="min-w-0 flex-1 truncate text-[15px] text-stone-700">
                      {member.displayName ?? "名無し"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
