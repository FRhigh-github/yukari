"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useGesture } from "@use-gesture/react";
import MemberCircle from "@/components/MemberCircle";
import MoodIcon from "@/components/MoodIcon";
import { MOODS, SHOW_MOOD_ON_HOME } from "@/lib/mood";
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
// 動かしたときは、指を離してもアイコンを押したことにせず、長押しも取り消します。
// 指は止めているつもりでも少し揺れるので、0 ではなく少しゆとりを持たせます
const DRAG_THRESHOLD = 10;

// これだけ押し続けたら長押し（ミリ秒）。ご報告の一覧の長押しと同じ長さです
const LONG_PRESS = 500;

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

// 読んだ手紙の id の一覧を、ブラウザの保存領域（localStorage）から取り出します。
// プライベートブラウズなどで保存領域が使えないと、読むだけで失敗する（例外が起きる）ことがあります。
// そのときは「まだ何も読んでいない」として扱い、手紙のボタンが押せなくならないようにします
function readLetterIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem("read_letter_ids") || "[]");
  } catch {
    return [];
  }
}

type MemberCirclesProps = {
  members: Member[];
  currentUserId: string;
};

export default function MemberCircles({
  members,
  currentUserId,
}: MemberCirclesProps) {
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
        return;
      }

      // LocalStorageから閲覧済みの手紙ID一覧を取得
      const readIds = readLetterIds();

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
    const readIds = readLetterIds();
    if (!readIds.includes(letterId)) {
      // 保存できなくても、手紙は開けるので気にしません（try の中で失敗しても先へ進みます）
      try {
        localStorage.setItem(
          "read_letter_ids",
          JSON.stringify([...readIds, letterId])
        );
      } catch {}
    }
    setOpenableCount(0); // 赤い通知マークを消去
  };

  // 自分は中心に置くので、輪に並べる人たちとは分けます
  const me = members.find((member) => member.id === currentUserId);
  const others = members.filter((member) => member.id !== currentUserId);
  // 自分の気持ち（ステータス）。設定していなければ undefined
  const myMood = MOODS.find((item) => item.value === me?.mood);

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

  // ▼ 長押しで小さなプロフィールを出している人の id。出していなければ null
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);

  // ▼ 指の操作のために覚えておくもの。描き直しで消えては困るので useRef に入れます
  //   longPressTimer = 長押しを数える時計（取り消すときに止めるので持っておきます）
  //   longPressed    = 長押しでプロフィールを出したか。出したあとは、指を動かしても模様を動かしません
  //   moved          = 今回の操作で、DRAG_THRESHOLD より指を動かしたか
  //   pinching       = いま2本指でつまんでいるか / pinched = 今回の操作の途中で、つまんだか
  //   blockClick     = 指を離したときの「押した」を取り消すか（動かした・つまんだ・長押ししたとき）
  //   lastTap        = 前に触れた時刻。ダブルタップを見分けるのに使います
  const longPressTimerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);
  const movedRef = useRef(false);
  const pinchingRef = useRef(false);
  const pinchedRef = useRef(false);
  const blockClickRef = useRef(false);
  const lastTapRef = useRef(0);

  const stopLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // 画面から消えるときに、数えかけの長押しの時計を止めます
  useEffect(() => stopLongPressTimer, []);

  // ▼ 指の操作（動かす・つまむ・長押し・ホイール）は、@use-gesture/react というライブラリで受け取ります。
  //
  //   前は画面に触れている指を自分で数えていました。ところが、指を離した合図を
  //   1回でも受け取りそこねると、離したはずの指が残り続け、次に触ったときに
  //   「2本指でつまんでいる」と勘違いして、ホームが固まることがありました。
  //   ライブラリは、途中で打ち切られた操作や2本目の指の出入りも含めて数えてくれます。
  //   （カードと手紙の画面でも同じライブラリを使っています）
  //
  //   target = この枠に直接つなぎます。ホイールで画面全体がスクロールするのを止めるため、
  //            passive: false（「止めることがある」とブラウザに伝える指定）にしています
  useGesture(
    {
      // ▼ 指1本で動かす。長押しも、ここで数えます。
      //   triggerAllEvents（下の設定）のため、触れた瞬間から毎回呼ばれます。
      //   指がほとんど動いていない間は「始まり・終わり」の目印（first / last）が付かないので、
      //   届いた合図の種類（event.type）で見分けます。
      //   途中で打ち切られた操作（pointercancel など）も、ライブラリが「離した」として1回だけ知らせてくれます
      //   intentional = DRAG_THRESHOLD より動かした
      onDrag: ({ intentional, delta: [dx, dy], event }) => {
        const isStart = event.type === "pointerdown";
        const isEnd =
          event.type === "pointerup" ||
          event.type === "pointercancel" ||
          event.type === "lostpointercapture";

        if (isStart) {
          longPressedRef.current = false;
          movedRef.current = false;
          pinchedRef.current = false;
          blockClickRef.current = false;

          // ダブルタップ（0.3秒以内に2回触れた）で、最初の表示に戻します
          const now = Date.now();
          if (now - lastTapRef.current < 300) {
            setView({ moveX: 0, moveY: 0, zoom: 1 });
          }
          lastTapRef.current = now;

          // 誰かのマルの上で触れたら、長押しを数え始めます（目印は MemberCircle の data-member-id）
          const circle =
            event.target instanceof Element
              ? event.target.closest<HTMLElement>("[data-member-id]")
              : null;
          const memberId = circle?.dataset.memberId;
          if (memberId !== undefined) {
            longPressTimerRef.current = window.setTimeout(() => {
              longPressTimerRef.current = null;
              longPressedRef.current = true;
              setOpenMemberId(memberId);
            }, LONG_PRESS);
          }
        }

        if (intentional) movedRef.current = true;

        // 指が動いた・離れた・2本指になったら、長押しは取り消します
        if (isEnd || intentional || pinchingRef.current) {
          stopLongPressTimer();
        }

        if (isEnd) {
          // ほとんど動かさずに離したときだけ、アイコンを押したことにします
          blockClickRef.current = movedRef.current || pinchedRef.current || longPressedRef.current;
          return;
        }

        // まだ少ししか動いていない間、2本指でつまんでいる間、
        // 長押しでプロフィールを出したあとは、模様を動かしません
        if (!intentional || pinchingRef.current || longPressedRef.current) return;
        setView((v) => ({ ...v, moveX: v.moveX + dx, moveY: v.moveY + dy }));
      },

      // ▼ 指2本：2本の指のあいだの距離で、拡大・縮小
      onPinch: ({ offset: [zoom], last }) => {
        pinchedRef.current = true;
        pinchingRef.current = !last;
        setView((v) => ({ ...v, zoom }));
      },

      // ▼ パソコンで確かめるときのために、マウスのホイールでも拡大・縮小できるようにします
      onWheel: ({ event, delta: [, dy] }) => {
        event.preventDefault();
        if (dy === 0) return;
        const ratio = dy < 0 ? 1.1 : 1 / 1.1;
        setView((v) => ({ ...v, zoom: clampZoom(v.zoom * ratio) }));
      },
    },
    {
      target: areaRef,
      eventOptions: { passive: false },
      drag: {
        // この距離より動かさずに離したら「押した（tap）」とみなします
        filterTaps: true,
        tapsThreshold: DRAG_THRESHOLD,
        // ふつうは、指が DRAG_THRESHOLD より動くまで onDrag を呼びません。
        // 長押しとダブルタップは「触れた瞬間」から数えたいので、最初から呼んでもらいます
        //（動いたかどうかは intentional で見分けます）
        triggerAllEvents: true,
        // capture: false = 指をこの枠に縛りつけません。
        // 縛ると、指を離したときの「押した」がアイコンではなく枠に届いてしまい、
        // アイコンを押してもご報告が開かなくなるためです
        pointer: { capture: false },
      },
      pinch: {
        // 拡大・縮小できる範囲。ホイールやダブルタップで変えた倍率から続けてつまめるよう、
        // 始まりの倍率は、いまの倍率を渡します
        scaleBounds: { min: MIN_ZOOM / fitZoom, max: MAX_ZOOM / fitZoom },
        from: () => [view.zoom, 0],
      },
    },
  );

  return (
    <div
      ref={areaRef}
      // touch-none = ブラウザ自体のスクロールや拡大をさせない（指の動きをこちらで受け取るため）
      className="relative h-full w-full touch-none overflow-hidden"
      // 動かしたあと・長押ししたあとに指を離したときは、アイコンを押したことにしません（リンクへ飛ばない）
      onClickCapture={(event) => {
        if (!blockClickRef.current) return;
        // 長押しのプロフィールは、画面のいちばん外側（body）に描いています。
        // そこでの「押した」は、この枠の中の出来事ではないので止めません
        if (!(event.target instanceof Node) || !areaRef.current?.contains(event.target)) return;
        blockClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
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
            // 長押ししたまま動かしたときに、リンクをつまんで運ぶ動きを始めないようにします
            draggable={false}
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
            {/* 自分の気持ち（ステータス）の印。まわりの人と同じ形です（MemberCircle.tsx） */}
            {SHOW_MOOD_ON_HOME && myMood ? (
              <span
                aria-label={myMood.label}
                className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-kin/40"
              >
                <MoodIcon value={myMood.value} className="h-3.5 w-3.5" />
              </span>
            ) : null}
          </Link>
        ) : null}

        {/* ▼ まわりのメンバー。長押しは上の onDrag で数え、プロフィールは MemberCircle が出します */}
        {others.map((member, index) => (
          <MemberCircle
            key={member.id}
            member={member}
            x={spots[index].x}
            y={spots[index].y}
            hideName
            isOpen={openMemberId === member.id}
            onClose={() => setOpenMemberId(null)}
          />
        ))}
      </div>
    </div>
  );
}