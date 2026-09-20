// components/DrawingPad.tsx
//
// ▼ このファイルは「お絵かきの部品」です。
// これまで app/draw/page.tsx に書いていた、描く・消す・全消しの処理を、
// 別ファイルの部品として取り出しました。
//
// ▼ なぜ部品に切り出すのか？
// 最終的には、投稿へのリアクションを描く画面など、
// 別の場所でも同じお絵かきを使いたいからです。
// page.tsx に全部書いたままだと、他の画面で使うたびにコピーが必要になります。
// 部品にしておけば、必要な場所で <DrawingPad /> と書くだけで使えます。
// (C言語で、同じ処理を関数にして、あちこちから呼ぶのと同じ考え方です)

// ▼ "use client" は、page.tsx ではなく、こちらのファイルに書きます。
// useRef や useState、クリックなどの操作は、ブラウザ側でしか動かないので、
// それらを使うこの部品に「ブラウザ側で動かす」と宣言します。
"use client";

import { useRef, useState } from "react";
import type { PointerEvent } from "react";

// ▼ props(プロップス)とは？
// 部品を使う側から、部品に渡す「引数」のことです。
// 今回は、canvasの横幅と縦幅を、使う側が決められるようにします。
//
// ▼ type の書き方
// 「渡してもらう値の形」を決める書き方で、C言語の構造体(typedef struct)に近いです。
// 「width は数値、height は数値」と決めておくと、
// 文字を渡してしまった、渡し忘れた、といった間違いを、書いた時点で教えてくれます。
type DrawingPadProps = {
  width: number;
  height: number;
};

// ▼ 関数の引数に { width, height } と書く理由
// 部品には、渡された値が1つの箱(オブジェクト)にまとまって届きます。
// { width, height } と書くと、その箱から width と height を取り出して、
// すぐ使える変数として受け取れます。
// (props.width, props.height と毎回書かなくて済みます)
export default function DrawingPad({ width, height }: DrawingPadProps) {
  // canvasタグを入れておく入れ物(これまでと同じ)
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 「いま描いている最中か」というフラグ(これまでと同じ)
  const isDrawingRef = useRef(false);

  // 「1つ前の位置」を覚えておく入れ物(これまでと同じ)
  const lastPosRef = useRef({ x: 0, y: 0 });

  // いま「ペン」か「消しゴム」か(これまでと同じ)
  const [tool, setTool] = useState<"pen" | "eraser">("pen");

  // 筆箱(ctx)を取り出す関数(これまでと同じ)
  const getContext = () => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return null;
    }
    return canvas.getContext("2d");
  };

  // 筆の設定をまとめた関数(これまでと同じ)
  const setupBrush = (ctx: CanvasRenderingContext2D) => {
    ctx.lineCap = "round";

    if (tool === "eraser") {
      // 描いた部分を透明に「くり抜く」(消しゴムの動き)
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 24;
      ctx.strokeStyle = "black";
      ctx.fillStyle = "black";
    } else {
      // 上に重ねて描く(普通の描き方)
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "black";
      ctx.fillStyle = "black";
    }
  };

  // ポインターの位置を「canvasの中の座標」に直す関数(これまでと同じ)
  const getPosition = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / canvas.clientWidth;
    const scaleY = canvas.height / canvas.clientHeight;

    return {
      x: (event.clientX - rect.left - canvas.clientLeft) * scaleX,
      y: (event.clientY - rect.top - canvas.clientTop) * scaleY,
    };
  };

  // ① 画面に触れた(またはボタンを押した)とき(これまでと同じ)
  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const ctx = getContext();
    if (ctx === null) {
      return;
    }

    const pos = getPosition(event);

    isDrawingRef.current = true;
    lastPosRef.current = pos;

    event.currentTarget.setPointerCapture(event.pointerId);

    setupBrush(ctx);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  // ② 触れたまま動かしたとき(これまでと同じ)
  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) {
      return;
    }

    const ctx = getContext();
    if (ctx === null) {
      return;
    }

    const pos = getPosition(event);
    const last = lastPosRef.current;

    setupBrush(ctx);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastPosRef.current = pos;
  };

  // ③ 描き終わったとき(これまでと同じ)
  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  // ④ 全消しボタンが押されたとき(これまでと同じ)
  const handleClear = () => {
    const ctx = getContext();
    if (ctx === null) {
      return;
    }
    const canvas = ctx.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // ボタンの見た目を返す関数(これまでと同じ)
  const buttonStyle = (isActive: boolean) => ({
    padding: "8px 16px",
    fontSize: "16px",
    border: "1px solid #888",
    borderRadius: "6px",
    backgroundColor: isActive ? "#222" : "white",
    color: isActive ? "white" : "black",
  });

  // ▼ 返す画面の一番外側は <div> にしました。
  // これまでの <main> と <h1>(ページ全体の枠と見出し)は、
  // 部品ではなく、使う側(page.tsx)の役目なので、ここには含めません。
  // この部品は「ボタン3つ + canvas」だけを返します。
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "12px",
        }}
      >
        <button
          type="button"
          onClick={() => setTool("pen")}
          aria-pressed={tool === "pen"}
          style={buttonStyle(tool === "pen")}
        >
          ペン
        </button>

        <button
          type="button"
          onClick={() => setTool("eraser")}
          aria-pressed={tool === "eraser"}
          style={buttonStyle(tool === "eraser")}
        >
          消しゴム
        </button>

        <button type="button" onClick={handleClear} style={buttonStyle(false)}>
          全消し
        </button>
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        // ▼ ここが今回の変更点です。
        // これまでは width={600} height={400} と数字を直接書いていました。
        // 今回は、部品を使う側から渡された width と height を使います。
        width={width}
        height={height}
        style={{
          border: "2px solid black",
          backgroundColor: "white",
          display: "block",
          maxWidth: "100%",
          height: "auto",
          touchAction: "none",
        }}
      />
    </div>
  );
}
