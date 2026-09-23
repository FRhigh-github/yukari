// その人のご報告を、インスタのストーリーのように画面いっぱいで1枚ずつ見せます。
//
//   画面の右側を押す / 左へスライド … 1つ前（古い）ご報告へ
//   画面の左側を押す / 右へスライド … 戻る（新しいほうへ）
//   上にスワイプ       … 手書きのカードが出てくる（ReactionCardSheet）
//   上のアイコン・名前 … その人のプロフィールへ
//   右上の ×           … 閉じて、ご報告の一覧（MemberPosts）に戻る
//
// 開いたご報告は「見た」と覚えておき、ホームで光らなくします（lib/seenPosts.ts）。

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactionBoard, { type Reaction } from "@/components/ReactionBoard";
import ReactionCardSheet from "@/components/ReactionCardSheet";
import { SEEN_COOKIE, parseSeen } from "@/lib/seenPosts";

// これ以上指が上へ動いたら「スワイプした」とみなします（px）
const SWIPE = 60;
// これより動きが小さければ「押した」とみなします（px）
const TAP = 10;

export type StoryPost = {
  id: string;
  title: string;
  body: string | null;
  createdAt: string;
  imageUrl: string | null;
  communityId: string;
  reactions: Reaction[];
};

type StoryViewerProps = {
  authorId: string;
  authorName: string;
  avatarUrl: string | null;
  posts: StoryPost[];
  // 一覧で押したご報告が何枚目か。そこから見始めます
  initialIndex: number;
  onClose: () => void;
};

export default function StoryViewer({
  authorId,
  authorName,
  avatarUrl,
  posts,
  initialIndex,
  onClose,
}: StoryViewerProps) {
  const router = useRouter();
  // いま何枚目か。0 がいちばん新しいご報告です
  const [index, setIndex] = useState(initialIndex);
  const [isWriting, setIsWriting] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const post = posts[index];

  // ▼ 開いたご報告を「見た」と Cookie に書いておきます（lib/seenPosts.ts）。
  //   ホームはこれを読んで、見ていない新しいご報告がある人だけを光らせます。
  //   その人について「見た中でいちばん新しい日時」だけを残します。
  useEffect(() => {
    if (post === undefined) return;
    const cookie = document.cookie
      .split("; ")
      .find((item) => item.startsWith(`${SEEN_COOKIE}=`))
      ?.slice(SEEN_COOKIE.length + 1);
    const seen = parseSeen(cookie);
    const before = seen[authorId];
    if (before !== undefined && new Date(before) >= new Date(post.createdAt)) return;
    seen[authorId] = post.createdAt;
    // max-age = 覚えておく長さ（秒）。1年
    document.cookie = `${SEEN_COOKIE}=${encodeURIComponent(JSON.stringify(seen))}; path=/; max-age=31536000; samesite=lax`;
  }, [authorId, post]);

  // 1つ古いほうへ / 新しいほうへ。端まで来たら、それ以上は進みません
  const goOlder = () => setIndex(Math.min(posts.length - 1, index + 1));
  const goNewer = () => setIndex(Math.max(0, index - 1));

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    startRef.current = null;
    if (start === null || post === undefined) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;

    // 横へのスライド。縦より横に大きく動いたときだけ、横のスライドとみなします。
    // 左へスライド（指を左へ）→ 古いほうへ。インスタと同じ向きです
    if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goOlder();
      else goNewer();
      return;
    }
    // 上にスワイプ → 手書きカードを出します
    if (dy < -SWIPE) {
      setIsWriting(true);
      return;
    }
    // ほとんど動いていなければ「押した」。左右どちらを押したかで進むか戻るか決めます
    if (Math.abs(dx) < TAP && Math.abs(dy) < TAP) {
      const rect = event.currentTarget.getBoundingClientRect();
      const isRight = event.clientX - rect.left > rect.width / 2;
      if (isRight) goOlder();
      else goNewer();
    }
  };

  return (
    // absolute inset-0 = アプリの枠（スマホ幅の1枚）いっぱいに広げます
    // ▼ 全体を白っぽい「もや」の見た目にしています。
    //   iPhone の Safari は、一番上の帯（時計や電池の所）を思いどおりの色にできません
    //   （iOS 26 から theme-color を見なくなったため）。
    //   帯はアプリと同じ明るい色になるので、画面のほうも明るくして、境目を目立たなくしています。
    <div className="absolute inset-0 z-40 select-none overflow-hidden bg-[#faf9f6]">
      {/* ▼ 写真。押す・スワイプはこの面で受け取ります。touch-none = 画面をスクロールさせない */}
      <div
        className="absolute inset-0 touch-none select-none"
        onPointerDown={(event) => {
          startRef.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={handlePointerUp}
      >
        {post?.imageUrl ? (
          <>
            {/* ▼ 後ろに、同じ写真を大きくぼかして敷きます。
                写真と画面の形が違うと上下か左右が余りますが、
                そこを帯ではなく写真の色でなじませるためです（インスタと同じやり方）。
                opacity-70 で少し薄くして、後ろの生成り色と混ぜ、白いもやのように見せます */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.imageUrl}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={post.id}
              src={post.imageUrl}
              alt=""
              draggable={false}
              fetchPriority="high"
              // object-contain = 写真を切らずに全部見せます。
              // 画面と形が違う写真で余ったところは、後ろのぼかした写真が見えます
              className="relative h-full w-full object-contain"
            />
          </>
        ) : null}
        {/* 上と下に白いもやをかけて、濃い色の文字を読めるようにします */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#faf9f6]/85 via-[#faf9f6]/30 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#faf9f6]/90 via-[#faf9f6]/50 to-transparent" />
      </div>

      {/* ▼ 上：何枚あるかの線と、その人のアイコン・名前。
          z-30 = 手書きカード（z-20）を出しているときも、× とアイコンを押せるように手前に置きます */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        {/* 1枚ごとの線。見ている所まで金色にします */}
        <div className="flex gap-1">
          {posts.map((item, itemIndex) => (
            <span
              key={item.id}
              className={`h-0.5 flex-1 rounded-full ${itemIndex <= index ? "bg-kin" : "bg-stone-300"}`}
            />
          ))}
        </div>

        <div className="mt-2 flex items-center">
          <Link
            href={`/members/${authorId}/profile`}
            className="pointer-events-auto flex min-h-11 min-w-0 items-center gap-2"
          >
            <span
              className="h-9 w-9 shrink-0 rounded-full bg-stone-400 bg-cover bg-center ring-2 ring-kin"
              style={
                avatarUrl
                  ? { backgroundImage: `url("${encodeURI(avatarUrl)}")` }
                  : undefined
              }
            />
            <span className="truncate text-sm font-bold text-stone-800">
              {authorName}
            </span>
            {post ? (
              <span className="shrink-0 text-xs text-stone-500">
                {new Date(post.createdAt).toLocaleDateString("ja-JP")}
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="pointer-events-auto ml-auto flex h-11 w-11 cursor-pointer items-center justify-center text-stone-700"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="h-7 w-7"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      </div>

      {/* ▼ 下：届いたお祝い・タイトル・本文 */}
      {post ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
          {/* お祝いの束だけは押して広げられるようにします */}
          <div className="pointer-events-auto inline-block pt-4">
            <ReactionBoard reactions={post.reactions} />
          </div>
          <h2 className="mb-1 text-2xl font-bold text-stone-800">{post.title}</h2>
          <p className="line-clamp-4 text-sm leading-relaxed text-stone-600">
            {post.body}
          </p>
          {/* 上にスワイプできることを、言葉ではなく上向きの印だけで伝えます */}
          <div className="mt-3 flex justify-center text-kin">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-8 w-8 animate-bounce"><path d="M6 15l6-6 6 6" /></svg>
          </div>
        </div>
      ) : (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-stone-500">
          まだご報告はありません。
        </p>
      )}

      {/* ▼ となり（前後）のご報告の写真を、見えない所で先に読んでおきます。
          進めた・戻した瞬間に、写真がもう届いている状態にするためです。
          hidden = 画面には出さないが、ブラウザは読み込んでおいてくれます */}
      {[posts[index - 1], posts[index + 1]].map((near) =>
        near?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={near.id} src={near.imageUrl} alt="" aria-hidden="true" className="hidden" />
        ) : null,
      )}

      {/* ▼ 手書きカード */}
      {isWriting && post ? (
        <ReactionCardSheet
          postId={post.id}
          communityId={post.communityId}
          onClose={() => setIsWriting(false)}
          onSent={() => {
            setIsWriting(false);
            // 取り直して、いま送ったお祝いを束に加えます
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
