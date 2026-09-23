"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import MemberCircle from "@/components/MemberCircle";
import type { Member } from "@/lib/home";
import { createClient } from "@/lib/supabase/client";

// 水引の色（globals.css と同じ）
const BENI = "#b7282e";
const KIN = "#c2a14d";

// となりどうしの距離（px、拡大・縮小する前の大きさ）。アイコンが約60pxなので、少しすき間を空けます
const GAP = 76;

// アイコンの半分の大きさ（px）。最初の表示で、画面の端からはみ出さないように使います
const ICON_RADIUS = 32;

// 拡大・縮小できる範囲（1 がもとの大きさ）
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;

// 触れてから、これ以上指が動いたら「動かした」とみなします（px）。
// 動かしたときは、指を離してもアイコンを押したことにしません
const DRAG_THRESHOLD = 6;

// 下タブと、右下・左下のボタンが重なる高さ（px）。
// 模様は画面の下の端まで描きますが、中心はこのぶん上にずらして、ボタンに隠れないようにします
const BOTTOM_COVER = 112;

// 蜂の巣の並びで、k 番目の輪にある場所を、真上から時計回りに並べて返します。
// 六角形の6つの角を順にたどり、角と角のあいだを k 等分して場所を置いていきます。
function hexRing(k: number) {
  const corners = Array.from({ length: 6 }, (_, i) => {
    const angle = ((-90 + i * 60) * Math.PI) / 180;
    return { x: Math.cos(angle) * k * GAP, y: Math.sin(angle) * k * GAP };
  });
  const spots: { x: number; y: number }[] = [];
  for (let side = 0; side < 6; side++) {
    const from = corners[side];
    const to = corners[(side + 1) % 6];
    for (let step = 0; step < k; step++) {
      const t = step / k;
      spots.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
    }
  }
  return spots;
}

// 輪の中で、どの順に埋めていくか。
// 前から順に埋めると片側に寄ってしまうので、半分・4分の1・4分の3…と
// 離れたところから交互に埋めて、人数が少なくても片寄らないようにします。
function spreadOrder(length: number) {
  const order: number[] = [];
  const used = new Set<number>();
  for (let j = 0; order.length < length; j++) {
    // j を2進数にして、左右を反転した小数（0, 0.5, 0.25, 0.75, …）を作ります
    let fraction = 0;
    let bit = 0.5;
    for (let n = j; n > 0; n = Math.floor(n / 2)) {
      if (n % 2 === 1) fraction += bit;
      bit /= 2;
    }
    const index = Math.floor(fraction * length);
    if (!used.has(index)) {
      used.add(index);
      order.push(index);
    }
  }
  return order;
}

// 人数ぶんの場所を、内側の輪から順に作ります。ring = その人が何番目の輪にいるか
function layout(count: number) {
  const spots: { x: number; y: number; ring: number }[] = [];
  for (let k = 1; spots.length < count; k++) {
    const ring = hexRing(k);
    for (const index of spreadOrder(ring.length)) {
      if (spots.length >= count) break;
      spots.push({ ...ring[index], ring: k });
    }
  }
  return spots;
}

type MemberCirclesProps = {
  members: Member[];
  currentUserId: string;
};

export default function MemberCircles({
  members,
  currentUserId,
}: MemberCirclesProps) {
  const [hasLetter, setHasLetter] = useState(false);
  const [openableCount, setOpenableCount] = useState<number>(0);
  const [letterId, setLetterId] = useState<string | null>(null);

  useEffect(() => {
    async function checkLetter() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 手紙が存在するか確認（飛行機マーク自体の表示判定用）
      const { data: allLetters, error } = await supabase
        .from("time_capsules")
        .select("id, open_at")
        .order("open_at", { ascending: true });

      if (error || !allLetters || allLetters.length === 0) {
        setHasLetter(false);
        return;
      }

      setHasLetter(true);

      // LocalStorageから閲覧済みの手紙ID一覧を取得
      const readIds: string[] = JSON.parse(
        localStorage.getItem("read_letter_ids") || "[]"
      );

      // 開封日時を過ぎていて、かつ未読の手紙を取得
      const now = new Date();
      const unreadOpenable = allLetters.filter(
        (item) => new Date(item.open_at) <= now && !readIds.includes(item.id)
      );

      setOpenableCount(unreadOpenable.length);

      // 遷移先IDの設定（未読の開封可能な手紙があればそれを最優先、なければ最新の手紙ID）
      if (unreadOpenable.length > 0) {
        setLetterId(unreadOpenable[0].id);
      } else {
        setLetterId(allLetters[0].id);
      }
    }

    checkLetter();
  }, []);

  // 飛行機アイコンタップ時に既読保存し、赤マーク通知だけを即座に消す関数
  const handleMarkAsRead = () => {
    if (!letterId) return;
    const readIds: string[] = JSON.parse(
      localStorage.getItem("read_letter_ids") || "[]"
    );
    if (!readIds.includes(letterId)) {
      localStorage.setItem(
        "read_letter_ids",
        JSON.stringify([...readIds, letterId])
      );
    }
    setOpenableCount(0); // 赤い通知マークを消去
  };

  // 自分は中心に置くので、輪に並べる人たちとは分けます
  const me = members.find((member) => member.id === currentUserId);
  const others = members.filter((member) => member.id !== currentUserId);

  // members は「報告がある人が先」に並んでいるので、そのまま内側の輪から埋まります
  const spots = layout(others.length);

  // ▼ 置く範囲の大きさ。画面に出てからでないと測れないので、最初は仮の大きさです
  const areaRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 360, height: 560 });

  useEffect(() => {
    const area = areaRef.current;
    if (area === null) return;
    // ResizeObserver = 大きさが変わるたびに教えてくれる仕組み
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  // ▼ 最初の表示の倍率。
  //   報告がある人がいる輪（少なくとも2つ目の輪）までが、画面に収まる倍率にします。
  const newsRing = Math.max(
    2,
    ...spots.filter((_, index) => others[index].hasNews).map((spot) => spot.ring),
  );
  const fitZoom = Math.min(
    MAX_ZOOM,
    Math.max(
      MIN_ZOOM,
      Math.min(size.width, size.height - BOTTOM_COVER) / 2 / (newsRing * GAP + ICON_RADIUS),
    ),
  );

  // ▼ いまの表示。move = 移動した量（px）、zoom = 最初の倍率に対して、さらに何倍か
  const [view, setView] = useState({ moveX: 0, moveY: 0, zoom: 1 });
  const scale = fitZoom * view.zoom;

  // 倍率を、決めた範囲（MIN_ZOOM〜MAX_ZOOM）に収めます
  const clampZoom = (zoom: number) =>
    Math.min(MAX_ZOOM / fitZoom, Math.max(MIN_ZOOM / fitZoom, zoom));

  // ▼ 指の動きを覚えておく場所。
  //   描き直しのたびに消えては困るので、useRef に入れておきます。
  //   pointers   = いま画面に触れている指の位置（指ごとの番号 → 位置）
  //   startPoint = 1本目の指が触れた位置。どれだけ動いたかを測るのに使います
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const startPointRef = useRef({ x: 0, y: 0 });
  const draggedRef = useRef(false);
  const lastTapRef = useRef(0);

  const handlePointerDown = (event: React.PointerEvent) => {
    const point = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, point);

    if (pointersRef.current.size === 1) {
      startPointRef.current = point;
      draggedRef.current = false;
      // ▼ ダブルタップ（0.3秒以内に2回触れた）で、最初の表示に戻します
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        setView({ moveX: 0, moveY: 0, zoom: 1 });
      }
      lastTapRef.current = now;
    } else {
      // 2本目の指が触れたら、つまむ操作なので「動かした」扱いにします
      draggedRef.current = true;
    }
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const pointers = pointersRef.current;
    const before = pointers.get(event.pointerId);
    if (before === undefined) return;
    const after = { x: event.clientX, y: event.clientY };

    if (pointers.size === 1) {
      // ▼ 指1本：動いたぶんだけ移動
      const dx = after.x - before.x;
      const dy = after.y - before.y;
      setView((v) => ({ ...v, moveX: v.moveX + dx, moveY: v.moveY + dy }));

      const start = startPointRef.current;
      if (Math.hypot(after.x - start.x, after.y - start.y) > DRAG_THRESHOLD) {
        draggedRef.current = true;
      }
    } else if (pointers.size === 2) {
      // ▼ 指2本：2本の指のあいだの距離が何倍になったかで、拡大・縮小
      const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
      if (other !== undefined) {
        const distanceBefore = Math.hypot(before.x - other.x, before.y - other.y);
        const distanceAfter = Math.hypot(after.x - other.x, after.y - other.y);
        if (distanceBefore > 0) {
          const ratio = distanceAfter / distanceBefore;
          setView((v) => ({ ...v, zoom: clampZoom(v.zoom * ratio) }));
        }
      }
    }

    pointers.set(event.pointerId, after);
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    pointersRef.current.delete(event.pointerId);
  };

  // ▼ パソコンで確かめるときのために、マウスのホイールでも拡大・縮小できるようにします。
  //   React の onWheel では、画面全体のスクロールを止められません
  //   （ブラウザが「止めない約束」で受け取る仕組みになっているため）。
  //   そこで、ブラウザに直接「止めることがある」と伝えて受け取ります（passive: false）。
  useEffect(() => {
    const area = areaRef.current;
    if (area === null) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const ratio = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      setView((v) => ({
        ...v,
        zoom: Math.min(MAX_ZOOM / fitZoom, Math.max(MIN_ZOOM / fitZoom, v.zoom * ratio)),
      }));
    };
    area.addEventListener("wheel", handleWheel, { passive: false });
    return () => area.removeEventListener("wheel", handleWheel);
  }, [fitZoom]);

  return (
    <div
      ref={areaRef}
      // touch-none = ブラウザ自体のスクロールや拡大をさせない（指の動きをこちらで受け取るため）
      className="relative h-full w-full touch-none overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      // 動かしたあとに指を離したときは、アイコンを押したことにしません（リンクへ飛ばない）
      onClickCapture={(event) => {
        if (draggedRef.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {/* ▼ 未来への手紙の入口。絵文字ではなく、ほかのボタンと同じ線の絵（紙飛行機）にしています。
          白地に金のふち・金の絵で、ふみばこのボタンとそろえています。
          読んでいない手紙があるときだけ、右上に紅い数字を出します */}
      {letterId ? (
        <Link
          href={`/letters/${letterId}`}
          onClick={handleMarkAsRead}
          aria-label="未来への手紙"
          className="absolute right-4 top-4 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-kin/60 bg-white text-kin shadow-md"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-6 w-6">
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
          {openableCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-beni px-1 text-xs font-bold text-white ring-2 ring-white">
              {openableCount > 99 ? "99+" : openableCount}
            </span>
          ) : null}
        </Link>
      ) : null}

      {/* ▼ 動かす中身。移動と拡大・縮小を、この1枚にまとめてかけます */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${view.moveX}px, ${view.moveY - BOTTOM_COVER / 2}px) scale(${scale})`,
        }}
      >
        {/* ▼ 水引の花の輪。アイコンより先に描いて、後ろに回します */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            {/* radialGradient = 中心から外へ向かって色が変わるグラデーション */}
            <radialGradient
              id="cord-gradient"
              gradientUnits="userSpaceOnUse"
              cx="0"
              cy="0"
              r={GAP * 2}
            >
              {/* 金を強めに。半分より内側で、もう金に変わります */}
              <stop offset="0%" stopColor={BENI} />
              <stop offset="40%" stopColor={KIN} />
              <stop offset="100%" stopColor="#e3c77f" />
            </radialGradient>
          </defs>
          {/* 50% の位置へずらして、中心を 0,0 にします */}
          <g style={{ transform: "translate(50%, 50%)" }} fill="none">
            {spots.map((spot, index) => {
              // 中心（0,0）とその人を、直径の両はしにする輪
              const radius = Math.hypot(spot.x, spot.y) / 2;
              return (
                <g key={index}>
                  <circle cx={spot.x / 2} cy={spot.y / 2} r={radius} stroke="url(#cord-gradient)" strokeWidth={1.1} opacity={0.8} />
                  {/* 少しだけ大きい輪をもう1本。2本の紐を束ねたように見せます */}
                  <circle cx={spot.x / 2} cy={spot.y / 2} r={radius + 3} stroke="url(#cord-gradient)" strokeWidth={0.8} opacity={0.5} />
                </g>
              );
            })}
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

        {/* ▼ まわりのメンバー。長押しでプロフィールが出るのは MemberCircle の働きです */}
        {others.map((member, index) => (
          <MemberCircle
            key={member.id}
            member={member}
            x={spots[index].x}
            y={spots[index].y}
            hideName
          />
        ))}
      </div>
    </div>
  );
}