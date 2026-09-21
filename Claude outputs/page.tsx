// app/letter/page.tsx
//
// 「未来の私たちへ手紙を送る」機能のページです。
// 白紙の手紙の上に、テキスト・写真・URL のカードを自由に置けます。
//
// ※ 封筒・スワイプして送信は、いったん保留にしています。

// この画面はブラウザで動かします(ボタンや指の操作があるため)
"use client";

import { useRef, useState } from "react";
// PointerEvent は「指やマウスで押した・動かした」ときの情報の型です
import type { PointerEvent } from "react";

// =====================================================
// 型(データの形)の決まりごと
// =====================================================

// type は「データの形に名前を付ける」TypeScript の書き方です。
// C言語の typedef に近いものです。

// カードの種類。3種類のどれかしか入りません。
type ItemType = "text" | "photo" | "url";

// 紙の上に置く「カード1枚分」のデータの形です。
// C言語の struct(構造体)とほぼ同じ考え方です。
// 種類によって使う項目は違いますが、扱いやすいように
// 全部の項目を1つの形にまとめています(使わない項目は空のままです)。
type Item = {
  id: number; // カードを見分けるための番号
  type: ItemType; // カードの種類
  x: number; // 紙の左端からの距離(px)
  y: number; // 紙の上端からの距離(px)
  text: string; // テキストカードの文字
  imageSrc: string; // 写真カードの画像
  url: string; // URLカードのURL
};

// 新しいカードを1枚作る関数です。
// 種類と位置だけ受け取って、残りの項目は空で埋めます。
function createItem(id: number, type: ItemType, x: number, y: number): Item {
  return {
    id,
    type,
    x,
    y,
    text: "",
    imageSrc: "",
    url: "",
  };
}

// 右に並べる〇ボタンの一覧(上から順番に表示されます)
// [ ] は「配列」、{ } は「オブジェクト(名前つきの値のまとまり)」です。
// C言語で言うと「構造体の配列」です。
const TOOLS: { type: ItemType; label: string }[] = [
  { type: "text", label: "テキスト" },
  { type: "photo", label: "写真" },
  { type: "url", label: "URL" },
];

// =====================================================
// ページ本体
// =====================================================
export default function LetterPage() {
  // 紙の上に置いてあるカードの一覧(最初は空っぽ = 白紙)
  // Item[] は「Item の配列」という意味です
  const [items, setItems] = useState<Item[]>([]);

  // 次に作るカードの番号(画面に出さないので useRef)
  // useRef は「画面を描き直さずに値を覚えておく箱」です
  const nextIdRef = useRef(1);

  // 白い紙そのものを指す箱(紙の位置や大きさを測るのに使います)
  const paperRef = useRef<HTMLDivElement>(null);

  // いまドラッグ中のカードの情報
  //   id      … どのカードを動かしているか
  //   offsetX … カードの左端から、指までの横の距離
  //   offsetY … カードの上端から、指までの縦の距離
  // ドラッグしていないときは null です
  const dragRef = useRef<{ id: number; offsetX: number; offsetY: number } | null>(
    null
  );

  // ----- カードを1枚追加する -----
  function addItem(type: ItemType) {
    const id = nextIdRef.current;
    nextIdRef.current += 1;

    // 同じ場所に重ならないように、置くたびに少しずつ右下にずらします
    // % は C言語と同じく「割った余り」です(6枚ごとに最初の位置に戻ります)
    const n = items.length % 6;

    // [...items, 新しいカード] は「今までのカードに、1枚足した新しい配列」です
    // ... は「スプレッド構文」で、配列の中身を展開する書き方です
    // React では配列を直接書き換えず、「新しい配列を作って set する」のが決まりです。
    // そうしないと React が変化に気づかず、画面が描き直されません。
    setItems([...items, createItem(id, type, 16 + n * 16, 16 + n * 40)]);
  }

  // ----- カードの中身を一部だけ書き換える -----
  // Partial<Item> は「Item の項目のうち、いくつかだけ」という意味です
  // 例：updateItem(3, { text: "こんにちは" })
  function updateItem(id: number, changes: Partial<Item>) {
    // prev は「いまの一覧」です
    // .map は「配列の1つ1つに同じ処理をして、新しい配列を作る」関数です
    // { ...it, ...changes } は「it の中身をコピーして、changes の分だけ上書き」です
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...changes } : it))
    );
  }

  // ----- カードを削除する -----
  function deleteItem(id: number) {
    // .filter は「条件に合うものだけ残した新しい配列を作る」関数です
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  // ----- ドラッグ開始(灰色の帯を押した瞬間) -----
  function handleDragStart(e: PointerEvent<HTMLDivElement>, item: Item) {
    if (paperRef.current === null) {
      return;
    }
    // getBoundingClientRect は「その部品が画面のどこに、どの大きさであるか」を返します
    const rect = paperRef.current.getBoundingClientRect();

    // 指が帯の外に出ても、この帯に動きを知らせ続けてもらう
    e.currentTarget.setPointerCapture(e.pointerId);

    // カードのどこをつかんだかを覚えておきます
    // (これがないと、つかんだ瞬間にカードの左上が指の位置へ飛んでしまいます)
    dragRef.current = {
      id: item.id,
      offsetX: e.clientX - rect.left - item.x,
      offsetY: e.clientY - rect.top - item.y,
    };
  }

  // ----- ドラッグ中(押したまま動かしている間) -----
  function handleDragMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag === null || paperRef.current === null) {
      return;
    }
    const rect = paperRef.current.getBoundingClientRect();

    // 紙の左上を基準にした、新しいカードの位置
    let x = e.clientX - rect.left - drag.offsetX;
    let y = e.clientY - rect.top - drag.offsetY;

    // 紙の外に出ていかないように、範囲に収めます
    x = Math.max(0, Math.min(x, rect.width - 60));
    y = Math.max(0, Math.min(y, rect.height - 40));

    updateItem(drag.id, { x, y });
  }

  // ----- ドラッグ終了(指を離した瞬間) -----
  function handleDragEnd() {
    dragRef.current = null;
  }

  // ----- カードの中身を、種類ごとに作る -----
  function renderBody(item: Item) {
    // ===== テキスト =====
    if (item.type === "text") {
      return (
        <textarea
          rows={3}
          value={item.text}
          onChange={(e) => updateItem(item.id, { text: e.target.value })}
          placeholder="テキストを入力"
          className="w-full resize-none text-sm outline-none"
        />
      );
    }

    // ===== 写真 =====
    if (item.type === "photo") {
      // まだ写真を選んでいなければ、ファイル選択を出します
      if (item.imageSrc === "") {
        return (
          <input
            // type="file" は「ファイルを選ぶ入力欄」、accept="image/*" で画像だけにします
            type="file"
            accept="image/*"
            onChange={(e) => {
              // ?. は「左側が空なら、そこで止める」書き方です
              const file = e.target.files?.[0];
              if (file) {
                // URL.createObjectURL は「選んだファイルを、このページの中だけで
                // 表示できる仮のアドレス」を作る関数です(アップロードはしません)
                updateItem(item.id, { imageSrc: URL.createObjectURL(file) });
              }
            }}
            className="w-full text-xs"
          />
        );
      }
      // 写真を選んだあとは、画像を表示します
      // (「next/image を使おう」という黄色い注意が出ても、動作には問題ありません)
      // draggable={false} … ブラウザ標準の「画像ドラッグ」を止める
      return (
        <img src={item.imageSrc} alt="選んだ写真" draggable={false} className="w-full rounded" />
      );
    }

    // ===== URL(ここまで来たら type は "url") =====
    // リンク部分を、先に変数に入れておきます
    // http で始まるときだけリンクを作り、それ以外は null(何も表示しない)にします
    // target="_blank" … 新しいタブで開く
    // rel="noopener noreferrer" … 開いた先のページから、この画面を操作されないようにする
    const link = item.url.startsWith("http") ? (
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-xs text-blue-600 underline">
        {item.url}
      </a>
    ) : null;

    return (
      <div>
        <input
          type="url"
          value={item.url}
          onChange={(e) => updateItem(item.id, { url: e.target.value })}
          placeholder="https://..."
          className="w-full border-b text-sm outline-none"
        />
        {link}
      </div>
    );
  }

  // =====================================================
  // 画面
  // =====================================================
  return (
    // flex … 中身を横に並べる(左：紙、右：〇ボタン)
    // 書いた順番に左から並ぶので、紙を先に、ボタンを後に書いています
    <main className="flex min-h-screen gap-3 bg-gray-100 p-3 text-black">
      {/* ===== 白紙の手紙 ===== */}
      {/* relative … カードを「この紙を基準に」置けるようにする */}
      {/* flex-1 … 残りの横幅を全部使う */}
      <div
        ref={paperRef}
        className="relative min-h-[85vh] flex-1 overflow-hidden rounded bg-white shadow"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="absolute w-56 rounded border bg-white shadow-sm"
            style={{ left: item.x, top: item.y }}
          >
            {/* ----- 灰色の帯(ここをつかんで動かす) ----- */}
            <div
              onPointerDown={(e) => handleDragStart(e, item)}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerCancel={handleDragEnd}
              className="flex cursor-move select-none items-center justify-between rounded-t bg-gray-100 px-2 py-1 text-xs text-gray-500"
              // この帯の上ではスマホのスクロールを止める
              style={{ touchAction: "none" }}
            >
              <span>⠿ 動かす</span>
              <button
                type="button"
                // stopPropagation … ×を押したとき、帯のドラッグが始まらないようにする
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => deleteItem(item.id)}
                aria-label="削除"
                className="px-1 text-base leading-none"
              >
                ×
              </button>
            </div>

            {/* ----- カードの中身 ----- */}
            <div className="p-2">{renderBody(item)}</div>
          </div>
        ))}
      </div>

      {/* ===== 右の〇ボタン3つ ===== */}
      {/* sticky top-3 … スクロールしても画面の上のほうに残る */}
      {/* h-[45vh] … 高さを画面の45%にし、justify-between で3つを均等に並べる */}
      <div className="sticky top-3 flex h-[45vh] flex-col justify-between self-start">
        {TOOLS.map((tool) => (
          <button
            key={tool.type}
            type="button"
            onClick={() => addItem(tool.type)}
            aria-label={`${tool.label}を追加`}
            // 白い丸に、細い枠線と小さな文字だけのシンプルな見た目です
            className="h-12 w-12 rounded-full border bg-white text-[10px]"
          >
            {tool.label}
          </button>
        ))}
      </div>
    </main>
  );
}
