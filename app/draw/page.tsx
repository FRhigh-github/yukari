// app/draw/page.tsx
//
// このファイルは、お絵かきの部品(DrawingPad)を置くだけの、短いページです。
// 「ページ」は画面全体の枠(見出しや余白)を担当し、
// 「部品」はお絵かきそのものを担当する、という役割分担です。
//
// ここには "use client" が要りません。
// ブラウザ側で動かす必要がある処理は、すべて DrawingPad の中にあるからです。

// ▼ import の書き方(相対パス)
// "../components/DrawingPad" は、ファイルの場所の書き方です。
//   .. : 1つ上のフォルダへ
// このファイルは app/draw/ の中にあります。
// 部品は app/components/ の中にあります。
// なので、次のようにたどります。
//   app/draw/ → (..)app/ → components/DrawingPad
// 前回は "../../components/DrawingPad" でした。
// ".." が1つ多いのは、部品を app の外に置く前提だったからです。
// 今回は app の中に置いたので、".." は1つです。
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
