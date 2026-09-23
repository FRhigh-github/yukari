// カードのタブは、いきなり「背景えらび」から始まります。
//
// 完成品を選ぶのではなく、土台を選んで、その上に自分で置いていく形です。
//
// このページはDBにも聞かず、URLも見ません。
// 中身が最初から決まっているので、Next.js が出来上がりを覚えておけます。
// ＝ 押した瞬間に出ます（サーバーとの往復が起きません）。

import CardBackgroundPicker from "@/components/CardBackgroundPicker";

export default function CardsPage() {
  return (
    <main className="p-5 pb-24">
      <h1 className="mb-3 text-xl font-bold text-stone-800">メッセージカード</h1>

      <CardBackgroundPicker />
    </main>
  );
}
