// データが届くまでの間、これが表示されます。
//
// 見た目の埋め合わせだけでなく、速さにも効きます。
// loading.tsx があるページは、Next.js が
// 「この部分だけ先に読み込んでおく」ことができるようになるためです。

export default function Loading() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-5 py-3">
        <div className="h-4 w-32 rounded bg-stone-200" />
      </div>

      {/* animate-pulse = ゆっくり点滅させて、読み込み中だと伝えます */}
      <div className="flex flex-1 animate-pulse flex-wrap content-start justify-around gap-y-10 px-8 pt-10">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="h-12 w-12 rounded-full bg-stone-200" />
        ))}
      </div>
    </div>
  );
}
