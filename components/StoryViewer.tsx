// その人のご報告を、1枚ずつ「ご報告のはがき」の形で見せます。
// （操作はインスタのストーリーと同じです）
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
import ReportPostcard from "@/components/ReportPostcard";

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
    // ▼ 背景は、手紙の画面と同じ生成りの紙の色です。その上に白いはがきを1枚置きます。
    //   iPhone の Safari は、一番上の帯（時計や電池の所）を思いどおりの色にできないので
    //   （iOS 26 から theme-color を見なくなったため）、明るい色にして境目を目立たなくしています。
    <div className="absolute inset-0 z-40 select-none overflow-hidden bg-[#f3ede2]">
      {/* ▼ 押す・スワイプはこの面で受け取ります。touch-none = 画面をスクロールさせない。
          真ん中に「ご報告のはがき」を1枚置きます。
          前は写真を画面いっぱいに出すストーリーの形でしたが、結婚や出産の報告は、
          もともとはがきや手紙の文化です。本文をきちんと読めるよう、はがきの形にしました。
          （操作はストーリーのときのままです） */}
      <div
        className="absolute inset-0 flex touch-none select-none items-stretch justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+10.5rem)] pt-[calc(env(safe-area-inset-top)+3.5rem)]"
        onPointerDown={(event) => {
          startRef.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={handlePointerUp}
      >
        {post ? (
          // ▼ はがき。白い紙に金の細いふち、少しだけ影を落として、机に置いた紙のように見せます
          // はがきの見た目は components/ReportPostcard.tsx（投稿のお試し・一覧と同じもの）。
          // h-full = 上の名前と下の案内のあいだを、はがきが全部使います
          <ReportPostcard
            key={post.id}
            size="full"
            title={post.title}
            body={post.body}
            createdAt={post.createdAt}
            imageUrl={post.imageUrl}
            authorName={authorName}
          />
        ) : (
          <p className="self-center text-sm text-stone-500">まだご報告はありません。</p>
        )}
      </div>

      {/* ▼ 上：その人のアイコン・名前（ストーリーのような「何枚あるかの線」は、はがきに合わないので外しました）。
          z-30 = 手書きカード（z-20）を出しているときも、× とアイコンを押せるように手前に置きます */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <div className="flex items-center">
          <Link
            href={`/members/${authorId}/profile`}
            className="pointer-events-auto flex min-h-11 min-w-0 items-center gap-2"
          >
            <span
              className="h-10 w-10 shrink-0 rounded-full bg-stone-400 bg-cover bg-center ring-2 ring-kin"
              style={
                avatarUrl
                  ? { backgroundImage: `url("${encodeURI(avatarUrl)}")` }
                  : undefined
              }
            />
            <span className="truncate text-base font-bold text-stone-800">
              {authorName}
            </span>
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

      {/* ▼ 下：届いたお祝いの束と、上にスワイプしてお祝いを書く案内。
          タイトルと本文は、はがきの中に移しました。
          はがきの下に、この2つが入るぶんの余白（pb-…10.5rem）を空けてあります。
          前は束がはがきの左下に重なって、本文が隠れていました */}
      {post ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          {/* お祝いの束だけは押して広げられるようにします。
              束はもともと「写真の下からのぞく」ように上へ食い込む作り（-mt-4）なので、
              pt-4 でそのぶんを戻して、はがきに重ならないようにしています */}
          <div className="pointer-events-auto self-start pt-4">
            <ReactionBoard reactions={post.reactions} />
          </div>
          {/* 上向きの印と、小さな一言。はじめての人が、お祝いを送れることに気づけるようにします */}
          <div className="mt-1 flex flex-col items-center text-kin">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-7 w-7 animate-bounce"><path d="M6 15l6-6 6 6" /></svg>
            <span className="text-base">上にスワイプしてお祝いを書く</span>
          </div>
        </div>
      ) : null}

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
