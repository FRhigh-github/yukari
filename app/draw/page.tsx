// app/draw/page.tsx
//
// お絵かきの部品(DrawingPad)を置くだけの、短いページです。
// ブラウザ側で動かす処理は、すべて DrawingPad の中にあるので、
// ここには "use client" が要りません。

// ▼ import の書き方(相対パス)
// 引用符の中の文字は、ファイルの場所と名前を表します。
//   .. : 1つ上のフォルダへ
// このファイルは app/draw/ の中、部品は app/components/ の中なので、
//   app/draw/ → (..)app/ → components/DrawingPad
// とたどります。
//
// ▼ 大文字と小文字は、ファイル名と完全に同じにします。
// "drawingpad" と "DrawingPad" は、別の名前として扱われます。
// ファイル名が DrawingPad.tsx なら、ここも DrawingPad と書きます(拡張子は書きません)。
import DrawingPad from "../components/DrawingPad";

export default function DrawPage() {
  return (
    <main style={{ padding: "16px" }}>
      <h1>お絵かき</h1>

      {/* 部品を置く。width と height は、部品に渡す値(props)です */}
      <DrawingPad width={600} height={400} />
    </main>
  );
}
