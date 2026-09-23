// 画面の一番上で、見るコミュニティを切り替える部品です。
//
// 選ぶとURLが変わります（例: /?c=xxxx）。
// 「今どれを選んでいるか」を URL に持たせておくと、
// その URL を開き直したときに同じ状態に戻ります。

"use client";

import Link from "next/link";
import { useState } from "react";
import Loader from "@/components/Loader";

export type Community = {
  id: string;
  name: string;
  // コミュニティのアイコン。決めていなければ null。
  // ? を付けてあるのは、この型を「名前を選ぶだけ」の画面でも使っているためです。
  // そちらではアイコンが要らないので、取ってきていません。
  icon_url?: string | null;
};

type CommunitySwitcherProps = {
  communities: Community[];
  // 今見ているコミュニティのid。1つも入っていないときだけ null。
  selectedId: string | null;
  memberCount: number;
  todayCount: number;
};

export default function CommunitySwitcher({
  communities,
  selectedId,
  memberCount,
  todayCount,
}: CommunitySwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  // ▼ 押した直後に、チップの名前だけ先に変えておくための覚え書きです。
  //
  // 切り替えは中身を取り直すので、少し時間がかかります。
  // そのあいだ名前が前のままだと「押せていない」と感じます。
  // 先に名前を変えておくと、押したことがその場で分かります。
  // 中身が届けば下の currentName が追いつくので、ずれは残りません。
  const [pressedName, setPressedName] = useState<string | null>(null);

  const selected = communities.find((community) => community.id === selectedId);
  const currentName = selected?.name ?? "コミュニティ";

  // 押した名前と、実際に出ている名前がずれている間が「切り替え中」です。
  // 新しい中身が届くと currentName が追いつくので、
  // 自分で「終わった」と書かなくても、ひとりでに消えます。
  const isSwitching = pressedName !== null && pressedName !== currentName;

  return (
    <>
      {/* 切り替え中は、結び目を出して待ってもらいます。
          変わるのはマルのところだけなので、
          上のバーと下のタブは出したままにします。 */}
      {isSwitching ? <Loader area="content" /> : null}

      {/* relative = この中の「absolute」が、このチップを基準に置かれるようになります。
        一覧をチップのすぐ下に出すために必要です。 */}
      <div className="relative min-w-0 flex-1">
        {/* ▼ 顔写真 ＋ 名前 ＋ 人数と今日の件数。
            名前だけのチップだったころは、どのコミュニティを見ているのか
            文字を読まないと分かりませんでした。
            顔を先に出すと、読む前に「あの人たちのところだ」と分かります。 */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          // cursor-pointer = PCで指マークにする指定。
          // Tailwind v4 から、ボタンでも自分で書かないと矢印のままになります。
          className="flex w-full cursor-pointer items-center gap-3 text-left"
        >
          {/* ▼ コミュニティのアイコン。
              まだ決めていないときは、名前の1文字目を出します。
              前はメンバーの顔を3枚重ねていましたが、
              コミュニティが増えると、どれも「人の顔が3つ」になって
                見分けがつきませんでした。

              四角にしているのは、人の顔（丸）と区別するためです。 */}
          <CommunityMark
            iconUrl={selected?.icon_url ?? null}
            name={pressedName ?? currentName}
            size="h-11 w-11 text-base"
          />

          {/* min-w-0 = 名前が長くても、この欄が押し広がらないようにする指定 */}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[17px] font-bold text-stone-800">
                {pressedName ?? currentName}
              </span>
              <span className="shrink-0 text-xs text-kin">▼</span>
            </span>
            <span className="block truncate text-xs text-stone-400">
              {memberCount}人
              {/* 今日の報告だけ金にして、目が行くようにします */}
              {todayCount > 0 ? (
                <span className="text-kin"> ・ 今日 {todayCount}件の報告</span>
              ) : null}
            </span>
          </span>
        </button>

        {isOpen ? (
          <>
            {/* 背景。押すと閉じます。
              チップより後ろ(z-40)に置いて、一覧(z-50)だけを前に出します。 */}
            <div
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/20"
            />

            {/* ▼ チップのすぐ下に出る一覧。
              top-full = チップの下端から。押した場所と出る場所をそろえます。 */}
            {/* ▼ 幅は、画面の端から16px残したところまで目いっぱい使います。
                w-60(240px) のときは名前が「しばよこハッカソ…」と切れていました。
                右に余っている場所があるのに切るのは、読む側に損なだけです。 */}
            <div className="absolute left-0 top-full z-50 mt-2 w-[calc(100vw-2rem)] max-w-[22rem] overflow-hidden rounded-2xl bg-white py-2 shadow-xl">
              <ul className="max-h-[50vh] overflow-y-auto overscroll-contain">
                {communities.map((community) => (
                  <li key={community.id}>
                    <ListRow
                      community={community}
                      isSelected={community.id === selectedId}
                      onSelect={() => {
                        setPressedName(community.name);
                        setIsOpen(false);
                      }}
                      onClose={() => setIsOpen(false)}
                    />
                  </li>
                ))}
              </ul>

              {/* 作る・参加する への入口も、同じ場所に置きます。
                切り替えのために開いたついでに操作できるほうが早いためです。 */}
              <div className="mt-2 border-t border-stone-100 pt-2">
                <Link
                  href="/communities/new"
                  onClick={() => setIsOpen(false)}
                  className="flex h-12 cursor-pointer items-center px-5 text-sm text-stone-600"
                >
                  ＋ コミュニティを新しく作る
                </Link>
                <Link
                  href="/communities/join"
                  onClick={() => setIsOpen(false)}
                  className="flex h-12 cursor-pointer items-center px-5 text-sm text-stone-600"
                >
                  招待コードで参加する
                </Link>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

// 一覧の1行。押す場所が2つあります。
//   名前  → そのコミュニティに切り替える
//   ⚙    → そのコミュニティの設定へ直接入る
// 設定だけ別ページから選び直す、という往復をなくすためです。
// どちらも高さ48pxで、iOS の「44px以上」を満たしています。
type ListRowProps = {
  community: Community;
  isSelected: boolean;
  // 名前を押したとき（切り替え）
  onSelect: () => void;
  // ⚙ を押したとき（一覧を閉じるだけ）
  onClose: () => void;
};

function ListRow({ community, isSelected, onSelect, onClose }: ListRowProps) {
  return (
    <div className="flex items-center gap-1 pl-3 pr-2">
      {/* ▼ ボタンではなく Link にしています。
          Link は、画面に出た時点で次のページを先に用意しておいてくれます。
          押してから取りに行かないぶん、切り替わりが速くなります。 */}
      <Link
        href={`/?c=${community.id}`}
        onClick={onSelect}
        // min-w-0 = 中身が長くても、欄を押し広げないようにする指定。
        // これが無いと名前が伸びて、右の「設定」が押し出されてしまいます。
        className={`flex h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl px-2 text-left text-sm ${
          isSelected ? "font-bold text-stone-900" : "text-stone-600"
        }`}
      >
        {/* アイコン。上のバーと同じ絵を出して、
            「いま押したものが、上に出ているものだ」と分かるようにします */}
        <CommunityMark
          iconUrl={community.icon_url ?? null}
          name={community.name}
          size="h-9 w-9 text-sm"
        />
        <span className="truncate">{community.name}</span>
        {/* shrink-0 = ✓ は縮めない。縮むと名前とくっついて見えます */}
        {isSelected ? (
          <span className="shrink-0 text-beni">✓</span>
        ) : null}
      </Link>

      {/* ▼ 設定への入口。
          前は ⚙ の絵だけを置いていましたが、
          文字が無いと「押せるもの」だと気づかれませんでした。
          薄い下地を敷いて、ボタンの形にしてあります。

          設定から戻ると、その行のコミュニティのホームに着きます。
          （押した行＝これから見る場所、というつながりにしています） */}
      <Link
        href={`/communities/${community.id}`}
        onClick={onClose}
        className="flex h-11 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-stone-100 px-3 text-xs text-stone-500"
      >
        <span>⚙</span>
        <span>設定</span>
      </Link>
    </div>
  );
}

// コミュニティを表す四角です。上のバーと一覧の両方で使います。
//
// アイコンが決まっていないコミュニティもあるので、
// そのときは名前の1文字目を出します。
// 空の四角より、文字があるほうが見分けがつくためです。
type CommunityMarkProps = {
  iconUrl: string | null;
  name: string;
  // 大きさ。置く場所で変えたいので、外から指定してもらいます
  size: string;
};

function CommunityMark({ iconUrl, name, size }: CommunityMarkProps) {
  return (
    <span
      // border-kin/50 = 金の細いふち。画像のあるなしにかかわらず、同じ枠に見せます
      className={`flex shrink-0 items-center justify-center rounded-xl border border-kin/50 bg-stone-100 bg-cover bg-center font-bold text-kin ${size}`}
      style={
        iconUrl
          ? { backgroundImage: `url("${encodeURI(iconUrl)}")` }
          : undefined
      }
    >
      {/* 絵があるときは文字を出しません。重なって読めなくなるためです */}
      {iconUrl ? null : name.slice(0, 1)}
    </span>
  );
}
