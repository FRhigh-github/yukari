// app/components/DrawingPad.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const COMMUNITY_ID = "dfda40cd-2953-45b0-8620-26f03b9d7c58";
const TEMPLATE_ID = "4f640157-e719-4bb5-9eea-78c54f7ccf6c";

type Tool = "pen" | "eraser";
type Point = { x: number; y: number };
type DrawingPadProps = {
  width: number;
  height: number;
};

// 筆の設定(これまでと同じ)
const setupBrush = (ctx: CanvasRenderingContext2D, tool: Tool) => {
  ctx.lineCap = "round";

  if (tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = 24;
    ctx.strokeStyle = "black";
    ctx.fillStyle = "black";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "black";
    ctx.fillStyle = "black";
  }
};

// 点を1つ描く(これまでと同じ)
const drawDot = (ctx: CanvasRenderingContext2D, tool: Tool, pos: Point) => {
  setupBrush(ctx, tool);
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.fill();
};

// 2点をつなぐ線を描く(これまでと同じ)
const drawSegment = (
  ctx: CanvasRenderingContext2D,
  tool: Tool,
  from: Point,
  to: Point,
) => {
  setupBrush(ctx, tool);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
};

// 画面上の座標を、canvasの中の座標に直す(これまでと同じ)
const toCanvasPoint = (
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): Point => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / canvas.clientWidth;
  const scaleY = canvas.height / canvas.clientHeight;

  return {
    x: (clientX - rect.left - canvas.clientLeft) * scaleX,
    y: (clientY - rect.top - canvas.clientTop) * scaleY,
  };
};

export default function DrawingPad({ width, height }: DrawingPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<Point>({ x: 0, y: 0 });

  // ▼ toolRef について
  // 今回、イベントの処理を useEffect の中に移しました。
  // useEffect の中の関数は、作られた時点の値を覚えてしまうので、
  // ペンから消しゴムに切り替えても、古いままになってしまいます。
  // useRef は「いつでも今の値が読める入れ物」なので、
  // 道具の切り替えは、こちら経由で伝えます。
  const toolRef = useRef<Tool>("pen");

  const pointerWorksRef = useRef(false);
  const moveCountRef = useRef(0);

  // ▼ 確認用の数え上げ
  // 画面全体で指を認識した回数と、canvasで認識した回数を分けて数えます。
  // 画面は反応しているのに canvas が 0 なら、canvasに指が届いていません。
  const pageTouchCountRef = useRef(0);
  const canvasTouchCountRef = useRef(0);

  const [tool, setTool] = useState<Tool>("pen");
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [debugText, setDebugText] = useState("まだ触っていません");

  // 道具が変わったら、入れ物にも反映する
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  // ▼ 今回の変更の中心
  // これまでは、Reactの onPointerDown などに処理を渡していました。
  // Reactはイベントを、いったん画面全体でまとめて受け取ってから、
  // それぞれの部品に配る仕組みです。
  // その配る途中で止まっている可能性があるので、
  // canvas そのものに、直接くっつける形に変えました。
  // addEventListener が、その「直接くっつける」命令です。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    const getCtx = () => canvas.getContext("2d");

    // 描き始め
    const start = (clientX: number, clientY: number, source: string) => {
      const ctx = getCtx();
      if (ctx === null) {
        setDebugText("ctx が取れません");
        return;
      }

      const pos = toCanvasPoint(canvas, clientX, clientY);
      isDrawingRef.current = true;
      lastPosRef.current = pos;
      moveCountRef.current = 0;
      setHasDrawn(true);
      drawDot(ctx, toolRef.current, pos);

      setDebugText(
        source +
          " 開始 / 位置:" +
          Math.round(pos.x) +
          "," +
          Math.round(pos.y) +
          " / 画面:" +
          pageTouchCountRef.current +
          " canvas:" +
          canvasTouchCountRef.current,
      );
    };

    // 動かしているあいだ
    const move = (clientX: number, clientY: number) => {
      if (!isDrawingRef.current) {
        return;
      }
      const ctx = getCtx();
      if (ctx === null) {
        return;
      }
      const pos = toCanvasPoint(canvas, clientX, clientY);
      moveCountRef.current += 1;
      drawSegment(ctx, toolRef.current, lastPosRef.current, pos);
      lastPosRef.current = pos;
    };

    // 描き終わり
    const end = () => {
      if (isDrawingRef.current) {
        setDebugText(
          "動いた回数:" +
            moveCountRef.current +
            " / 画面:" +
            pageTouchCountRef.current +
            " canvas:" +
            canvasTouchCountRef.current,
        );
      }
      isDrawingRef.current = false;
    };

    // ▼ globalThis.PointerEvent について
    // React の PointerEvent と、ブラウザ本来の PointerEvent は別ものです。
    // 直接くっつける今回は、ブラウザ本来のほうを使うので、
    // globalThis. を付けて、そちらだと明示しています。
    const onPointerDown = (event: globalThis.PointerEvent) => {
      pointerWorksRef.current = true;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // 失敗しても続行
      }
      start(event.clientX, event.clientY, "pointer(" + event.pointerType + ")");
    };

    const onPointerMove = (event: globalThis.PointerEvent) => {
      move(event.clientX, event.clientY);
    };

    const onTouchStart = (event: globalThis.TouchEvent) => {
      canvasTouchCountRef.current += 1;
      event.preventDefault();
      if (pointerWorksRef.current) {
        return; // ポインターが動いているなら、そちらに任せる
      }
      const touch = event.touches[0];
      if (touch === undefined) {
        return;
      }
      start(touch.clientX, touch.clientY, "touch");
    };

    const onTouchMove = (event: globalThis.TouchEvent) => {
      event.preventDefault();
      if (pointerWorksRef.current) {
        return;
      }
      const touch = event.touches[0];
      if (touch === undefined) {
        return;
      }
      move(touch.clientX, touch.clientY);
    };

    const onTouchEnd = () => {
      if (pointerWorksRef.current) {
        return;
      }
      end();
    };

    // ▼ 画面全体の反応を数える(確認用)
    // canvas に届かなくても、画面のどこかを触れば、ここは増えます。
    const onPageTouch = () => {
      pageTouchCountRef.current += 1;
      if (canvasTouchCountRef.current === 0) {
        setDebugText(
          "画面は反応:" +
            pageTouchCountRef.current +
            " / canvas:0（canvasに届いていません）",
        );
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("touchcancel", onTouchEnd);
    document.addEventListener("touchstart", onPageTouch, { passive: true });

    // 画面が消えるときに、付けたものを全部外します
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", end);
      canvas.removeEventListener("pointercancel", end);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
      document.removeEventListener("touchstart", onPageTouch);
    };
  }, [isSent]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (ctx === null) {
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const makePngBlob = async () => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return null;
    }

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;

    const exportCtx = exportCanvas.getContext("2d");
    if (exportCtx === null) {
      return null;
    }

    exportCtx.fillStyle = "white";
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.drawImage(canvas, 0, 0);

    return await new Promise<Blob | null>((resolve) => {
      exportCanvas.toBlob(resolve, "image/png");
    });
  };

  const handleSend = async () => {
    setIsSending(true);
    setErrorText(null);

    try {
      const supabase = createClient();

      const userResult = await supabase.auth.getUser();
      const user = userResult.data.user;
      if (user === null) {
        throw new Error("ログインしていません。/login からログインしてください");
      }

      const blob = await makePngBlob();
      if (blob === null) {
        throw new Error("画像への変換に失敗しました");
      }

      const path = user.id + "/" + crypto.randomUUID() + ".png";
      const uploadResult = await supabase.storage
        .from("drawings")
        .upload(path, blob, { contentType: "image/png" });
      if (uploadResult.error !== null) {
        throw new Error("画像の保存: " + uploadResult.error.message);
      }

      const insertResult = await supabase.from("card_sends").insert({
        template_id: TEMPLATE_ID,
        from_user: user.id,
        to_user: user.id,
        community_id: COMMUNITY_ID,
        drawing_url: path,
      });
      if (insertResult.error !== null) {
        throw new Error("card_sends への保存: " + insertResult.error.message);
      }

      setIsSent(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "不明なエラーが起きました";
      setErrorText(message);
    } finally {
      setIsSending(false);
    }
  };

  const buttonStyle = (isActive: boolean, isDisabled = false) => ({
    padding: "10px 16px",
    fontSize: "16px",
    border: "1px solid #888",
    borderRadius: "6px",
    backgroundColor: isActive ? "#222" : "white",
    color: isActive ? "white" : "black",
    opacity: isDisabled ? 0.4 : 1,
    cursor: isDisabled ? "not-allowed" : "pointer",
    touchAction: "manipulation" as const,
  });

  if (isSent) {
    return (
      <div>
        <p>送信しました。</p>
      </div>
    );
  }

  // ▼ canvas から on... の指定が全部消えています。
  // 処理は上の useEffect で、直接くっつけているからです。
  return (
    <div style={{ overscrollBehavior: "none" }}>
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
        width={width}
        height={height}
        style={{
          border: "2px solid black",
          backgroundColor: "white",
          display: "block",
          maxWidth: "100%",
          height: "auto",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        }}
      />

      <p style={{ fontSize: "12px", marginTop: "8px" }}>{debugText}</p>

      <button
        type="button"
        onClick={handleSend}
        disabled={!hasDrawn || isSending}
        style={{
          ...buttonStyle(true, !hasDrawn || isSending),
          marginTop: "8px",
        }}
      >
        {isSending ? "送信中..." : "送信する"}
      </button>

      {errorText !== null && (
        <p style={{ color: "red", marginTop: "12px" }}>{errorText}</p>
      )}
    </div>
  );
}
