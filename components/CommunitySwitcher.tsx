// 画面の一番上で、見るコミュニティを切り替える部品です。
//
// 選ぶとURLが変わります（例: /?c=xxxx）。
// 「今どれを選んでいるか」を URL に持たせておくと、
// その URL を開き直したときに同じ状態に戻りますし、
// 中身を取ってくるのはサーバー側（app/page.tsx）に任せられます。

"use client";

import { useRouter } from "next/navigation";

export type Community = {
  id: string;
  name: string;
};

type CommunitySwitcherProps = {
  communities: Community[];
  // 今選んでいるコミュニティのid。「すべて」のときは null。
  selectedId: string | null;
};

export default function CommunitySwitcher({
  communities,
  selectedId,
}: CommunitySwitcherProps) {
  const router = useRouter();

  return (
    <div className="relative">
      <select
        // value に null は入れられないので、「すべて」は空文字で表します
        value={selectedId ?? ""}
        onChange={(event) => {
          const value = event.target.value;
          // 空文字なら「すべて」なので、? を付けずにホームへ戻ります
          router.push(value === "" ? "/" : `/?c=${value}`);
        }}
        // appearance-none = ブラウザが勝手に付ける矢印を消す。
        // 自前の ▼ を下で置いているので、二重になるのを防ぎます。
        className="appearance-none bg-transparent pr-5 text-sm text-stone-600 focus:outline-none"
      >
        <option value="">すべてのコミュニティ</option>
        {communities.map((community) => (
          <option key={community.id} value={community.id}>
            {community.name}
          </option>
        ))}
      </select>

      {/* pointer-events-none = この ▼ は押せない扱いにする。
          こうしないと、▼ を押したときに select が開きません。 */}
      <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[10px] text-stone-400">
        ▼
      </span>
    </div>
  );
}
