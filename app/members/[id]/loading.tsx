// loading.tsx という名前でファイルを置くと、
// そのページのデータが届くまでの間、これが代わりに表示されます。
//
// ご報告の画面は、縦長の写真を3列に並べた一覧です（MemberPosts）。
// 待っている間も同じ形・同じ色にしておくと、中身が届いたときに
// 写真がそのまま浮かび上がるだけに見え、「読み込み中」の感じが出ません。

export default function Loading() {
  return (
    <div className="min-h-full bg-[#faf9f6]">
      {/* 上の帯。戻るボタン・アイコン・名前の場所です（MemberPosts と同じ高さ） */}
      <div className="flex items-center gap-1 border-b border-kin/30 px-2 py-1">
        <span className="h-11 w-11" />
        <span className="h-8 w-8 rounded-full bg-stone-200 ring-2 ring-kin/40" />
        <span className="ml-2 h-4 w-24 rounded bg-stone-200" />
      </div>
      {/* 写真の枠を9枚ぶん */}
      <div className="grid grid-cols-3 gap-0.5">
        {Array.from({ length: 9 }, (_, index) => (
          <span key={index} className="aspect-[9/16] bg-stone-200/70" />
        ))}
      </div>
    </div>
  );
}
