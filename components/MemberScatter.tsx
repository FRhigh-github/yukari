// ホーム画面の真ん中に、メンバーのアイコンを散らして置く部品です。
//
//   ・報告があった人から先に置きます（lib/home.ts でその順に並べてあります）
//   ・置ける数を超えた人は「その他」にまとめ、押すと一覧で見られます
//   ・アイコンどうしを、水引の紅か金の細いまっすぐな線でつなぎます
//   ・名前は出しません。長押しで出るプロフィールで名前が分かります
//
// ▼ 並べ方の決まり（デザインの見本を調べて見つけたもの）
//   ① 1段に1人。上から、ほぼ同じ間隔で下がっていく
//   ② 右・左・右・左…と交互にジグザグ。ときどき1人だけ真ん中に来て、リズムが崩れる
//   ③ 線は、1人から下の人へ1本ずつ。つなぐ相手は「1つ下」か「2つ下」のどちらか。
//      ときどき「3つ下」の人とも、もう1本つなぐ。
//      前は「1つ下」と「2つ下」の両方と必ずつないでいましたが、
//      それだと左右に縦の柱ができて、はしごのように見えていました。
//
//   段の数は画面の高さで決めます（1段 ROW_GAP px）。背の低いスマホでは人数が減ります。
//
//   ゆらぎは Math.random() ではなく、番号とメンバーの顔ぶれから決めています。
//   Math.random() だと、開くたびに形が変わるうえ、
//   サーバーとブラウザで違う形になって React に怒られるためです。

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import MemberCircle from "@/components/MemberCircle";
import type { Member } from "@/lib/home";

// 1段の高さ（px）。
// アイコン（約60px）より低くしていますが、1段ごとに左右へ振るので、
// 上下のとなりどうしは横に離れていて重なりません。同じ側どうしは2段ぶん（76px）離れます
const ROW_GAP = 38;

// 段の数の、いちばん少ない数と多い数
const MIN_ROWS = 4;
const MAX_ROWS = 18;

// 左右の位置の範囲（置く範囲の幅に対する %）。
// 端まで広く使うように、見本より外側まで広げています
const LEFT = { min: 4, max: 30 };
const RIGHT = { min: 70, max: 96 };
// 真ん中は狭くします。上下のとなりの人と近くなりすぎて、重ならないようにするため
const CENTER = { min: 47, max: 53 };

// 何人ごとに1人、真ん中に寄せるか（見本では 7人目）
const CENTER_EVERY = 7;

// 高さのゆれ（1段の高さに対する割合）。0 だと定規で測ったように並びます
const WOBBLE = 0.2;

// 「1つ下」ではなく「2つ下」の人とつなぐ割合。
// 2つ下は同じ側なので、縦に近い線になります。縦の線が少しあると、形に変化が出ます
const SKIP = 0.5;

// 「3つ下」の人とも、もう1本つなぐ割合
const EXTRA = 0.25;

// つなぐ線の色（水引の紅と金。globals.css と同じ）
const BENI = "#b7282e";
const KIN = "#c2a14d";

// 文字列から、0 以上 1 未満の数を作ります（同じ文字列なら、いつも同じ数）。
//
// FNV-1a という、よく使われる混ぜ方です。
// 文字を1つ読むたびに「今の値と混ぜて、大きな数をかける」をくり返します。
// 最後にもう一度かき混ぜて、似た文字列（"-x-1" と "-x-2" など）からも
// まったく違う数が出るようにしています。前はここが弱く、左右の位置がそろってしまっていました。
function hashToUnit(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    // Math.imul = 32ビットのままかけ算する命令（ふつうの * だと桁があふれて精度が落ちる）
    hash = Math.imul(hash, 16777619);
  }
  // 仕上げのかき混ぜ
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13;
  // >>> 0 = 符号なしの数に直す。2^32 で割ると 0〜1 になります
  return (hash >>> 0) / 4294967296;
}

type MemberScatterProps = {
  members: Member[];
  currentUserId: string;
};

// 置く場所1つぶん。x, y は置く範囲の幅・高さに対する %（0〜100）
type Spot = {
  x: number;
  y: number;
};

export default function MemberScatter({
  members,
  currentUserId,
}: MemberScatterProps) {
  const [isListOpen, setIsListOpen] = useState(false);

  // ▼ 置く範囲の高さから、段の数を決めます。
  //   高さは、画面に出てからでないと測れません。
  //   最初は見本と同じ 9段 で出しておき、測れたら段の数を直します。
  const areaRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(9);

  useEffect(() => {
    const area = areaRef.current;
    if (area === null) return;

    // ResizeObserver = 大きさが変わるたびに教えてくれる仕組み。
    // 画面を回したときや、アドレスバーが出入りしたときにも追いかけます。
    const observer = new ResizeObserver(([entry]) => {
      const fit = Math.floor(entry.contentRect.height / ROW_GAP);
      setRows(Math.min(MAX_ROWS, Math.max(MIN_ROWS, fit)));
    });
    observer.observe(area);

    // 画面から消えるときに、見張りをやめます
    return () => observer.disconnect();
  }, []);

  // 自分は並べません。自分のことは下タブのプロフィールから見られるためです
  const others = members.filter((member) => member.id !== currentUserId);

  // 全員が入りきるなら全部の段を使い、入りきらないなら最後の段を「その他」に空けます
  const fitsAll = others.length <= rows;
  const shown = fitsAll ? others : others.slice(0, rows - 1);
  const rest = others.slice(shown.length);
  const used = shown.length + (rest.length > 0 ? 1 : 0);

  // ゆらぎの種。メンバーの顔ぶれが変わらなければ、形も変わりません
  const seed = others.map((member) => member.id).join();

  // ▼ ①② 置く場所
  const spots: Spot[] = Array.from({ length: used }, (_, i) => {
    // その範囲の中で、どのあたりに置くか（0〜1）
    const pick = hashToUnit(`${seed}-x-${i}`);
    const range =
      i % CENTER_EVERY === CENTER_EVERY - 1
        ? CENTER
        : i % 2 === 0
          ? RIGHT
          : LEFT;
    // 使う段だけで上から下まで広げます（人数が少なくても、上に固まらないように）
    const wobble = (hashToUnit(`${seed}-y-${i}`) - 0.5) * 2 * WOBBLE;
    return {
      x: range.min + (range.max - range.min) * pick,
      y: ((i + 0.5 + wobble) / used) * 100,
    };
  });
  const restSpot = rest.length > 0 ? spots[used - 1] : null;

  // ▼ ③ 線
  const links: [number, number][] = [];
  for (let i = 0; i < used - 1; i++) {
    // 下の人へ1本。最後から2人目は、1つ下しか相手がいません
    const skip = i + 2 < used && hashToUnit(`${seed}-skip-${i}`) < SKIP;
    links.push([i, skip ? i + 2 : i + 1]);

    // ときどき、3つ下の人とももう1本
    if (i + 3 < used && hashToUnit(`${seed}-extra-${i}`) < EXTRA) {
      links.push([i, i + 3]);
    }
  }

  // ▼ 線から外れてしまった人がいないか確かめて、いれば1つ上の人とつなぎます。
  //   「2つ下」へ飛ばした線が続くと、あいだの人にどこからも線が来ないことがあるためです。
  for (let j = 1; j < used; j++) {
    const hasLink = links.some(([a, b]) => a === j || b === j);
    if (!hasLink) links.push([j - 1, j]);
  }

  return (
    <div className="relative h-full w-full">
      {/* ▼ アイコンを置く範囲。まわりから少し内側に絞ります。
            マルは「点を中心に」置くので、端のマスに来た人は半分はみ出してしまいます。
            上はバーの下、左右は画面の外、下は「報告する」ボタンの裏に隠れないようにしています。
            アイコンの半分（約30px）ぶんだけ空けて、それ以上は空けません（まわりがすかすかに見えるため）。
            下は、ふみばこと報告のボタンのぶん（56px）を空けています。
            inset-x-8 = 左右 32px、top-6 = 上 24px、bottom-14 = 下 56px 空ける */}
      <div ref={areaRef} className="absolute inset-x-8 bottom-14 top-6">
        {/* ▼ アイコンどうしをつなぐ線。アイコンより先に描いて、後ろに回します。
              viewBox を 0〜100 にして、置く位置の % をそのまま座標に使っています。
              preserveAspectRatio="none" = 縦横の比がずれても、枠いっぱいに合わせる
              vectorEffect="non-scaling-stroke" = そのとき線の太さまで伸び縮みしないようにする */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          {links.map(([i, j]) => (
            // 線の色は、紅か金のどちらか。メンバーの顔ぶれから決めるので、開くたびには変わりません
            <line
              key={`${i}-${j}`}
              x1={spots[i].x}
              y1={spots[i].y}
              x2={spots[j].x}
              y2={spots[j].y}
              stroke={hashToUnit(`${i}-${j}-${seed}`) < 0.5 ? BENI : KIN}
              strokeWidth={1.2}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              opacity={0.7}
            />
          ))}
        </svg>

        {shown.map((member, index) => (
          <div
            key={member.id}
            // w-0 h-0 の点を置いて、その点を中心にマルを出します
            className="absolute h-0 w-0"
            style={{ left: `${spots[index].x}%`, top: `${spots[index].y}%` }}
          >
            <MemberCircle member={member} x={0} y={0} hideName />
          </div>
        ))}

        {/* ▼ 入りきらなかった人。最後のマスに「その他」として置きます */}
        {restSpot ? (
          <div
            className="absolute h-0 w-0"
            style={{ left: `${restSpot.x}%`, top: `${restSpot.y}%` }}
          >
            <button
              type="button"
              onClick={() => setIsListOpen(true)}
              aria-label={`その他 ${rest.length}人を見る`}
              className="absolute left-1/2 top-1/2 flex h-[57px] w-[57px] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-kin/60 bg-white text-sm font-bold text-kin"
            >
              {/* マルの大きさは、ほかの人のアイコンとそろえています */}
              +{rest.length}
            </button>
          </div>
        ) : null}
      </div>

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
                          ? {
                              backgroundImage: `url("${encodeURI(member.avatarUrl)}")`,
                            }
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
