// ストーリー画面で、上にスワイプすると下から出てくる手書きカードです。
//
//   カードの中を指でなぞる          … 書く
//   カードの外で、上にスワイプ      … 送る（カードが上へ飛んでいきます）
//   カードの外で、下にスワイプ      … やめる
//
// 書く場所（canvas）の上でスワイプすると線になってしまうので、
// 送る・やめるの合図は、カードの外（写真が見えている所）で受け取ります。

"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// これ以上指が上下に動いたら「スワイプした」とみなします（px）
const SWIPE = 60;

type ReactionCardSheetProps = {
  postId: string;
  communityId: string;
  onClose: () => void;
  // 送り終わったあとに呼びます。画面を取り直して、届いたお祝いに加えるためです
  onSent: () => void;
};

export default function ReactionCardSheet({
  postId,
  communityId,
  onClose,
  onSent,
}: ReactionCardSheetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const swipeStartRef = useRef<number | null>(null);
  // カードの枠とつまみ。「それ以外の所を押したか」を調べるのに使います
  const cardRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  const [hasDrawn, setHasDrawn] = useState(false);
  const [isSending, setIsSending] = useState(false);
  // 送ったあと、カードが上へ飛んでいく動きのため
  const [isFlying, setIsFlying] = useState(false);
  // 出てきた直後に、下から上がってくる動きのため
  const [isShown, setIsShown] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  // スワイプ中に、カードを指について動かすための量（px）
  const [dragY, setDragY] = useState(0);

  // ▼ 画質の調整。スマホは 1px に2〜3個の点があるので、そのぶん細かくします
  //   （DrawingPad.tsx と同じ考え方です）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * ratio);
    canvas.height = Math.round(canvas.clientHeight * ratio);
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#b7282e";
    // 出てきた次の瞬間に動きを始めます（最初から上にあると、動きが見えないため）
    requestAnimationFrame(() => setIsShown(true));
  }, []);

  // 指の位置を、canvas の中の座標に直します
  const toPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handleSend = async () => {
    const canvas = canvasRef.current;
    if (canvas === null || isSending) return;
    if (!hasDrawn) {
      setErrorText("何か書いてから送ってください");
      return;
    }
    setIsSending(true);
    setErrorText(null);

    try {
      const supabase = createClient();
      // getClaims() = ログインの証明書の署名を、この場で確かめる命令。
      // getUser() と違って Supabase まで聞きに行かないので、送るまでの待ちが1回ぶん減ります
      //（詳しくは lib/supabase/server.ts の getCurrentUserId）
      const { data } = await supabase.auth.getClaims();
      const userId = data?.claims.sub;
      if (!userId) throw new Error("ログインしていません");

      // canvas は背景が透明なので、白を敷いてから画像にします
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const exportCtx = exportCanvas.getContext("2d");
      if (exportCtx === null) throw new Error("画像への変換に失敗しました");
      exportCtx.fillStyle = "white";
      exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      exportCtx.drawImage(canvas, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => {
        exportCanvas.toBlob(resolve, "image/png");
      });
      if (blob === null) throw new Error("画像への変換に失敗しました");

      // 送り方は /draw（DrawingPad.tsx）と同じです
      const path = `${userId}/${crypto.randomUUID()}.png`;
      const upload = await supabase.storage
        .from("drawings")
        // cacheControl = ブラウザに「この写真は1年間そのまま使い回してよい」と伝えます。
        // ファイル名は毎回ちがう id なので、同じ名前の中身が変わることはありません
        .upload(path, blob, { contentType: "image/png", cacheControl: "31536000" });
      if (upload.error !== null) throw new Error("画像の保存: " + upload.error.message);

      const insert = await supabase.from("post_reactions").insert({
        post_id: postId,
        from_user: userId,
        community_id: communityId,
        drawing_url: path,
      });
      if (insert.error !== null) throw new Error("保存に失敗: " + insert.error.message);

      // カードを上へ飛ばしてから閉じます
      setIsFlying(true);
      setTimeout(onSent, 450);
    } catch (error) {
      // 原因は開発者向けに残し、画面には分かりやすい言葉だけを出します
      console.error("お祝いを送れませんでした", error);
      setErrorText("送れませんでした。電波の良いところで、もう一度お試しください");
      setIsSending(false);
    }
  };

  // カードの位置。出てくる前は下、送ったら上へ
  const cardMove = isFlying ? "-translate-y-[120vh]" : isShown ? "translate-y-0" : "translate-y-[100vh]";

  return (
    // ▼ カードの外側。ここでのスワイプを「送る・やめる」の合図にします
    <div
      className="absolute inset-0 z-20 flex touch-none select-none flex-col justify-end bg-[#faf9f6]/60 px-4 backdrop-blur-sm pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
      onPointerDown={(event) => {
        swipeStartRef.current = event.clientY;
        // 指がカードの上まで動いても、最後までこちらで受け取るための命令。
        // これが無いと、下から上へスワイプしたとき、離した場所がカードの上になり、
        // カード（書く場所）のほうに取られてしまっていました
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = swipeStartRef.current;
        if (start === null) return;
        setDragY(event.clientY - start);
      }}
      onPointerUp={(event) => {
        const start = swipeStartRef.current;
        swipeStartRef.current = null;
        setDragY(0);
        if (start === null) return;
        const dy = event.clientY - start;
        if (dy < -SWIPE) handleSend();
        if (dy > SWIPE) onClose();
        // ▼ ほとんど動かさずに、カードとつまみ以外の所を押したら閉じます（上でも下でも）
        const isInside = (box: DOMRect | undefined) =>
          box !== undefined &&
          event.clientX >= box.left &&
          event.clientX <= box.right &&
          event.clientY >= box.top &&
          event.clientY <= box.bottom;
        if (
          Math.abs(dy) < 10 &&
          !isInside(cardRef.current?.getBoundingClientRect()) &&
          !isInside(handleRef.current?.getBoundingClientRect())
        ) {
          onClose();
        }
      }}
    >
      <div
        className={`${dragY === 0 ? "transition-transform duration-500 ease-out" : ""} ${cardMove}`}
        // スワイプ中は、カードが指についてくるように少し動かします
        style={dragY === 0 ? undefined : { translate: `0 ${dragY * 0.6}px` }}
      >
        {/* ▼ つまみ。ここを上に引くと送れます。
            カードの中は「書く」場所なので、スワイプはここ（とカードの外）で受け取ります */}
        <div ref={handleRef} className="mx-auto mb-2 flex h-16 max-w-[58vh] flex-col items-center justify-center gap-1 rounded-2xl bg-white/70 text-kin ring-1 ring-kin/40 backdrop-blur">
          {/* 言葉は出さず、上向きの印だけにしています。送っている間だけ文字を出します */}
          {isSending ? (
            <span className="text-sm font-bold">送っています…</span>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-8 w-8 animate-bounce"><path d="M6 15l6-6 6 6" /></svg>
          )}
        </div>

        {/* ▼ カード。ご祝儀袋と同じく、白い台紙に金のふちです */}
        {/* 画面の横幅いっぱいまで大きくして、書きやすくしています。
            max-w-[58vh] = 背の低い画面でも、カードが下にはみ出さないようにします */}
        <div ref={cardRef} className="relative mx-auto max-w-[58vh] rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-kin">
          {/* ▼ ペンの印。ここに手書きできる、と言葉なしで伝えます。
              書き始めたら、じゃまにならないように消します */}
          {hasDrawn ? null : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 text-kin/50"
            >
              <path d="M4 20h4L19 9l-4-4L4 16z" />
              <path d="M14 6l4 4" />
            </svg>
          )}
          <canvas
            ref={canvasRef}
            // このカードの中の動きは「書く」なので、外側のスワイプに伝えません
            onPointerDown={(event) => {
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              lastPointRef.current = toPoint(event);
            }}
            onPointerMove={(event) => {
              const last = lastPointRef.current;
              const ctx = canvasRef.current?.getContext("2d");
              if (last === null || !ctx) return;
              const point = toPoint(event);
              ctx.beginPath();
              ctx.moveTo(last.x, last.y);
              ctx.lineTo(point.x, point.y);
              ctx.stroke();
              lastPointRef.current = point;
              setHasDrawn(true);
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
              lastPointRef.current = null;
            }}
            className="aspect-square w-full touch-none rounded-xl bg-[#faf9f6]"
          />
        </div>

        {errorText ? (
          <p className="mt-2 text-center text-xs font-bold text-beni">{errorText}</p>
        ) : null}
      </div>
    </div>
  );
}
