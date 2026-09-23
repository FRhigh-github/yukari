// ホーム画面の真ん中に出す、水引の「梅結び」です。
//
// 梅結びは、ほどけにくいことから「末永く」の意味で使われる結び方です。
// 「終わらない」というこのアプリの考え方に合わせています。
//
//   抜けていく紐   → 結び目の中から出て、左下へ抜け、下で右へ曲がって画面の外へ。
//                    その上にメンバーを重ねて並べる。押すと一覧が開く
//
// 形の座標は lib/umeKnot.ts にあります（scripts/ume_knot.py が計算したもの）。

"use client";

import Link from "next/link";
import { useState } from "react";
import type { Member } from "@/lib/home";
import {
  UME_HEIGHT,
  UME_OVER,
  UME_PILE_X,
  UME_PILE_Y,
  UME_UNDER,
  UME_WIDTH,
} from "@/lib/umeKnot";

// ▼ 見た目は「線画 ＋ 金の差し色」です。
//   紐は塗りつぶさず、2本の細い線（ふち）だけで描きます。
//   背景の模様として、主役のメンバーより前に出すぎないようにするためです。

// 線の色。水引の「金」（globals.css の --mizuhiki-kin と同じ）
const LINE = "#c2a14d";

// 紐の太さと、ふちの線の太さ
const CORD_WIDTH = 22;
const LINE_WIDTH = 1.4;

// 紐の中身の色（背景と同じ白）。
// ふちの線の上に、少し細い白い線を重ねると、2本線の紐になります。
// 上を通る紐の白い中身が、下の紐の線を隠すので、重なりの上下も自然に見えます。
const FILL = "#ffffff";

// 模様全体の濃さ（0〜1）
const PATTERN_OPACITY = 0.75;

// 重ねて見せる人数。これより多い人は「+3」のように数だけ出します
const PILE_MAX = 3;

// 絵の座標を「絵の幅・高さに対する %」に直します。
// メンバーのマルは絵の外（HTML）に置くので、同じ位置に合わせるために使います。
const toPercent = (x: number, y: number) => ({
  left: `${(x / UME_WIDTH) * 100}%`,
  top: `${(y / UME_HEIGHT) * 100}%`,
});

type MizuhikiHomeProps = {
  members: Member[];
  currentUserId: string;
};

export default function MizuhikiHome({
  members,
  currentUserId,
}: MizuhikiHomeProps) {
  // 下の一覧を開いているか
  const [isListOpen, setIsListOpen] = useState(false);

  // 自分は並べません。自分のことは下タブのプロフィールから見られるためです
  const others = members.filter((member) => member.id !== currentUserId);

  // members は lib/home.ts で「報告がある人が先」に並べてあります。
  // その順のまま、下の紐の上に重ねて置きます（報告がある人の顔が先に見える）。
  const onCord = others;

  return (
    <div className="flex h-full items-center justify-center">
      <div
        className="relative"
        style={{
          aspectRatio: `${UME_WIDTH} / ${UME_HEIGHT}`,
          width: `min(100%, calc((100dvh - 13rem) * ${UME_WIDTH / UME_HEIGHT}))`,
        }}
      >
        <svg
          viewBox={`0 0 ${UME_WIDTH} ${UME_HEIGHT}`}
          // pointer-events-none = 模様は押せないようにします（背景なので、下のものを邪魔しない）
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          // 絵全体をまとめて薄くします。
          // 1本ずつ薄くすると、紐が重なったところだけ濃く見えてしまうためです。
          style={{ opacity: PATTERN_OPACITY }}
          aria-hidden="true"
        >
          {/* ▼ 結び目を囲む、点線の円（2重）。
                strokeDasharray="0.5 6" = 0.5 だけ描いて 6 あける、をくり返す＝点線 */}
          <circle cx={UME_WIDTH / 2} cy={UME_HEIGHT / 2} r={UME_WIDTH * 0.49} fill="none" stroke={LINE} strokeWidth={1.2} strokeDasharray="0.5 6" strokeLinecap="round" />
          <circle cx={UME_WIDTH / 2} cy={UME_HEIGHT / 2} r={UME_WIDTH * 0.56} fill="none" stroke={LINE} strokeWidth={0.8} />

          {/* ▼ 紐。下を通る区間 → 上を通る区間 の順に、
                「ふちの線（太め）→ 白い中身（少し細め）」を重ねて2本線にします。
                上を通る区間の白が、下を通る紐の線を隠すので、上下が見えます。 */}
          <path d={UME_UNDER} fill="none" stroke={LINE} strokeWidth={CORD_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
          <path d={UME_UNDER} fill="none" stroke={FILL} strokeWidth={CORD_WIDTH - LINE_WIDTH * 2} strokeLinecap="round" strokeLinejoin="round" />
          <path d={UME_OVER} fill="none" stroke={LINE} strokeWidth={CORD_WIDTH} strokeLinecap="butt" strokeLinejoin="round" />
          {/* 白い中身だけ端を丸くします。
                となりの区間とのつなぎ目に出る、細い線のすじを隠すためです。
                （丸い端は紐の幅の内側に収まるので、ふちの線ははみ出しません） */}
          <path d={UME_OVER} fill="none" stroke={FILL} strokeWidth={CORD_WIDTH - LINE_WIDTH * 2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {/* ▼ 下を右へ伸びる紐の上に、メンバーを重ねて置きます。押すと一覧が開きます。
              -translate-x-1/2 -translate-y-1/2 = 自分の大きさの半分ずつ戻して、
              指定した点がちょうど真ん中に来るようにします。 */}
        {onCord.length > 0 ? (
          <button
            type="button"
            onClick={() => setIsListOpen(true)}
            aria-label="メンバーを見る"
            // 白い札や影は使わず、線画に合わせて「細い金の線」だけで見せます
            className="absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center gap-1.5"
            style={toPercent(UME_PILE_X, UME_PILE_Y)}
          >
            {/* -space-x-2 = 右のマルを左へ寄せて、少し重ねます。
                ring = 外側の細い線。白い ring を内側に、金の線を外側に重ねて、2本線にしています */}
            <span className="flex -space-x-2">
              {onCord.slice(0, PILE_MAX).map((member) => (
                <span
                  key={member.id}
                  className="h-8 w-8 rounded-full border border-kin bg-white bg-cover bg-center ring-2 ring-white"
                  style={
                    member.avatarUrl
                      ? { backgroundImage: `url("${encodeURI(member.avatarUrl)}")` }
                      : undefined
                  }
                />
              ))}
            </span>

            {/* 入りきらない人の数。明朝体の金の文字にして、和のテイストにそろえます */}
            {onCord.length > PILE_MAX ? (
              <span
                className="rounded-full border border-kin bg-white px-2 py-0.5 text-[11px] tracking-wider text-kin"
                style={{ fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif' }}
              >
                ほか {onCord.length - PILE_MAX} 人
              </span>
            ) : null}
          </button>
        ) : null}
      </div>

      {/* ▼ メンバー一覧。下からせり上がる板です */}
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
              メンバー（{others.length}人）
            </p>

            <ul>
              {others.map((member) => (
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
                    {/* 報告がある人には、紅い点を付けます */}
                    {member.hasNews ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-beni" />
                    ) : null}
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
