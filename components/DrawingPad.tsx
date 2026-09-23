"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Tool = "pen" | "eraser";
type Point = { x: number; y: number };

type DrawingPadProps = {
  // どの報告への反応か。この2つが無いと保存できません。
  postId: string | null;
  communityId: string | null;
  authorName: string | null;
  postImageUrl: string | null;
  // 送り終わったあと・やめたときに戻る先。元いた画面の住所です。
  backHref: string;
};

const setupBrush = (ctx: CanvasRenderingContext2D, tool: Tool) => {
  ctx.lineCap = "round";
  ctx.strokeStyle = "black";
  ctx.fillStyle = "black";

  // destination-out = 描いたところを「消す」モード
  ctx.globalCompositeOperation =
    tool === "eraser" ? "destination-out" : "source-over";
  ctx.lineWidth = tool === "eraser" ? 24 : 6;
};

const drawDot = (ctx: CanvasRenderingContext2D, tool: Tool, pos: Point) => {
  setupBrush(ctx, tool);
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.fill();
};

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

// 指の位置を、canvas の左上から数えた位置に直す
const toCanvasPoint = (
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): Point => {
  const rect = canvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
};

// ペンと消しゴムは形が同じなので、部品にまとめています
type ToolButtonProps = {
  label: string;
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function ToolButton({ label, isActive, onClick, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
      // h-11 w-11 = 44px。iOS の「押せるものは44px以上」に合わせています
      className={`flex h-11 w-11 items-center justify-center rounded-full shadow-md ${
        isActive ? "bg-stone-800 text-white" : "bg-white text-stone-600"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  );
}

export default function DrawingPad({
  postId,
  communityId,
  authorName,
  postImageUrl,
  backHref,
}: DrawingPadProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<Point>({ x: 0, y: 0 });
  const pointerWorksRef = useRef(false);

  // useEffect の中の関数は、作られた時点の値を覚えてしまいます。
  // useRef は「いつでも今の値が読める入れ物」なので、道具の切り替えはこれで伝えます。
  const toolRef = useRef<Tool>("pen");

  const [tool, setTool] = useState<Tool>("pen");
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  // 画質の調整。
  // canvas は「中身の細かさ」と「画面に映る大きさ」が別もので、
  // 中身が足りないと拡大したようにボケます。
  // スマホは 1px の中に2〜3個の点があるので（devicePixelRatio）、その分だけ細かくします。
  // 座標もその倍になってしまうため、ctx.scale で目盛りを元に戻しています。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const ratio = window.devicePixelRatio || 1;
    const nextWidth = Math.round(canvas.clientWidth * ratio);
    const nextHeight = Math.round(canvas.clientHeight * ratio);

    // 大きさを入れ直すと中身が消えるので、同じなら何もしない
    if (canvas.width === nextWidth && canvas.height === nextHeight) return;

    canvas.width = nextWidth;
    canvas.height = nextHeight;
    canvas.getContext("2d")?.scale(ratio, ratio);
  }, []);

  // 描く処理。canvas に直接くっつけています。
  // React 経由だと、途中で止まってスマホで描けないことがあったためです。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const getCtx = () => canvas.getContext("2d");

    const start = (clientX: number, clientY: number) => {
      const ctx = getCtx();
      if (ctx === null) return;

      const pos = toCanvasPoint(canvas, clientX, clientY);
      isDrawingRef.current = true;
      lastPosRef.current = pos;
      setHasDrawn(true);
      drawDot(ctx, toolRef.current, pos);
    };

    const move = (clientX: number, clientY: number) => {
      const ctx = getCtx();
      if (!isDrawingRef.current || ctx === null) return;

      const pos = toCanvasPoint(canvas, clientX, clientY);
      drawSegment(ctx, toolRef.current, lastPosRef.current, pos);
      lastPosRef.current = pos;
    };

    const end = () => {
      isDrawingRef.current = false;
    };

    // globalThis を付けているのは、React のものではなくブラウザ本来の型を指すためです
    const onPointerDown = (event: globalThis.PointerEvent) => {
      pointerWorksRef.current = true;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // 失敗しても続行
      }
      start(event.clientX, event.clientY);
    };

    const onPointerMove = (event: globalThis.PointerEvent) => {
      move(event.clientX, event.clientY);
    };

    // 下の touch 系は、pointer が使えない端末のための控えです
    const onTouchStart = (event: globalThis.TouchEvent) => {
      event.preventDefault();
      const touch = event.touches[0];
      if (pointerWorksRef.current || touch === undefined) return;
      start(touch.clientX, touch.clientY);
    };

    const onTouchMove = (event: globalThis.TouchEvent) => {
      event.preventDefault();
      const touch = event.touches[0];
      if (pointerWorksRef.current || touch === undefined) return;
      move(touch.clientX, touch.clientY);
    };

    const onTouchEnd = () => {
      if (pointerWorksRef.current) return;
      end();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("touchcancel", onTouchEnd);

    // 画面を離れるときに、付けたものを全部外します
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", end);
      canvas.removeEventListener("pointercancel", end);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // canvas をそのまま送ると背景が透明なので、白を敷いてから画像にします
  const makePngBlob = async () => {
    const canvas = canvasRef.current;
    if (canvas === null) return null;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;

    const exportCtx = exportCanvas.getContext("2d");
    if (exportCtx === null) return null;

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

      const { data } = await supabase.auth.getUser();
      if (data.user === null) {
        throw new Error("ログインしていません");
      }

      if (postId === null || communityId === null) {
        throw new Error("どの報告への反応か分かりません");
      }

      const blob = await makePngBlob();
      if (blob === null) {
        throw new Error("画像への変換に失敗しました");
      }

      const path = `${data.user.id}/${crypto.randomUUID()}.png`;
      const upload = await supabase.storage
        .from("drawings")
        // cacheControl = ブラウザに「この写真は1年間そのまま使い回してよい」と伝えます。
        // ファイル名は毎回ちがう id なので、同じ名前の中身が変わることはありません
        .upload(path, blob, { contentType: "image/png", cacheControl: "31536000" });
      if (upload.error !== null) {
        throw new Error("画像の保存: " + upload.error.message);
      }

      // post_reactions = 報告への手書きリアクション。
      // 年賀状などの card_sends とは別のテーブルです（schema.sql のコメント参照）。
      const insert = await supabase.from("post_reactions").insert({
        post_id: postId,
        from_user: data.user.id,
        community_id: communityId,
        drawing_url: path,
      });
      if (insert.error !== null) {
        throw new Error("保存に失敗: " + insert.error.message);
      }

      // 元いた画面へ戻ります。
      // refresh() は、戻った先で反応を取り直させるための合図です。
      router.push(backHref);
      router.refresh();
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "不明なエラーが起きました",
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-stone-400">
      {/* 上半分：反応する相手のご報告 */}
      <div className="px-4 pb-4 pt-5">
        <div className="mb-2 flex items-center gap-2">
          {/* やめるときの戻り道。44px 確保しています */}
          <Link
            href={backHref}
            aria-label="やめる"
            className="-ml-2 flex h-11 w-11 items-center justify-center text-xl text-white"
          >
            ×
          </Link>
          <div className="h-7 w-7 rounded-full bg-stone-300" />
          <span className="text-sm text-white">{authorName ?? "ご報告"}</span>
        </div>

        <div className="relative overflow-hidden rounded-xl bg-stone-300">
          {postImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={postImageUrl} alt="" className="h-52 w-full object-cover" />
          ) : (
            <div className="h-52 w-full" />
          )}

          {/* 画像の上に重ねる案内。bg-black/30 で暗くして文字を読みやすくします */}
          <div className="absolute inset-0 flex flex-col items-center justify-end gap-1 bg-black/30 pb-4">
            <svg
              viewBox="0 0 24 24"
              width="28"
              height="28"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 19V5" />
              <path d="m5 12 7-7 7 7" />
            </svg>
            <span className="text-sm font-bold text-white">スワイプして送信</span>
          </div>
        </div>
      </div>

      {/* 下半分：手書きの紙。上の角だけ丸めて、下から出てきたように見せています */}
      <div className="relative flex flex-1 flex-col rounded-t-[2rem] bg-white p-4 pt-6 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
        <canvas
          ref={canvasRef}
          className="w-full flex-1 rounded-lg"
          // touchAction: none = 指で描いている間、画面がスクロールしないようにする
          style={{ touchAction: "none", userSelect: "none" }}
        />

        <div className="absolute bottom-5 right-5 flex gap-2">
          <ToolButton
            label="ペン"
            isActive={tool === "pen"}
            onClick={() => setTool("pen")}
          >
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          </ToolButton>

          <ToolButton
            label="消しゴム"
            isActive={tool === "eraser"}
            onClick={() => setTool("eraser")}
          >
            <path d="M20 20H7L3 16a2 2 0 0 1 0-3l8-8a2 2 0 0 1 3 0l6 6a2 2 0 0 1 0 3l-6 6" />
          </ToolButton>
        </div>

        {/* 送信はいずれスワイプにする予定。今はボタンです */}
        <div className="absolute bottom-5 left-5 flex items-center gap-3">
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-stone-400"
          >
            全消し
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={!hasDrawn || isSending}
            className="rounded-full bg-stone-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-30"
          >
            {isSending ? "送信中..." : "送信"}
          </button>
        </div>

        {errorText !== null && (
          <p className="absolute bottom-16 left-5 text-xs text-red-600">
            {errorText}
          </p>
        )}
      </div>
    </div>
  );
}
