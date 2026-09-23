// loading.tsx という名前でファイルを置くと、
// そのページのデータが届くまでの間、これが代わりに表示されます。
//
// ご報告の画面は、ストーリーのように画面いっぱいで見せます（StoryViewer）。
// 待っている間も同じ形・同じ色にしておくと、中身が届いたときに
// 写真と文字がそのまま浮かび上がるだけに見え、「読み込み中」の感じが出ません。
//
// 前は一覧の形の灰色の箱を点滅させていましたが、
// 届いた画面とまったく形が違うので、切り替わりが目立っていました。

export default function Loading() {
  return (
    // StoryViewer と同じく、アプリの枠いっぱいに広げます
    <div className="absolute inset-0 z-40 bg-[#faf9f6]">
      <div className="px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        {/* 何枚目かの線の場所 */}
        <div className="h-0.5 rounded-full bg-stone-300" />
        {/* アイコンの場所。44px の行にそろえて、届いたときに位置がずれないようにします */}
        <div className="mt-2 flex min-h-11 items-center gap-2">
          <span className="h-9 w-9 rounded-full bg-stone-200 ring-2 ring-kin/40" />
        </div>
      </div>
    </div>
  );
}
