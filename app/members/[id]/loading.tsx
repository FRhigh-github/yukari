// loading.tsx という名前でファイルを置くと、
// そのページのデータが届くまでの間、これが代わりに表示されます。
//
// これが無いと、押してから中身が届くまで何も起きず、
// 画面が動き終わったあとに、間をおいて中身が出てきます。
// 先に「形だけ」を出しておくと、その間が埋まります。
//
// animate-pulse = ゆっくり点滅させる（読み込み中だと伝わります）

export default function Loading() {
  return (
    <main className="p-6 pb-24">
      <div className="h-4 w-12 rounded bg-stone-200" />
      <div className="mb-4 mt-3 h-6 w-48 rounded bg-stone-200" />

      <div className="animate-pulse space-y-3">
        <div className="h-28 rounded-2xl bg-stone-100" />
        <div className="h-28 rounded-2xl bg-stone-100" />
      </div>
    </main>
  );
}
