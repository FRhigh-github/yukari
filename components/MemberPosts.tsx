// その人のご報告を、インスタのリールの一覧のように、縦長の写真で3列に並べます。
//
//   写真を押す       … そこからストーリー（StoryViewer）で大きく見る
//   自分の写真を長押し … 「この投稿を消す」を選べる
//
// 写真の上には、タイトルだけを重ねます。本文や日付は、押して開いたストーリーで見せます。

"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import StoryViewer, { type StoryPost } from "@/components/StoryViewer";

// 長押しとみなすまでの時間（ミリ秒）。ホームのアイコンの長押しと同じ長さにそろえています
const LONG_PRESS_MS = 500;
// これ以上指が動いたら、長押しではなくスクロールとみなします（px）
const MOVE_TOLERANCE = 10;

type MemberPostsProps = {
  authorId: string;
  authorName: string;
  avatarUrl: string | null;
  posts: StoryPost[];
  // 自分のご報告の一覧かどうか。自分のものだけ消せるようにします
  isMine: boolean;
  // 最初からストーリーで開いておくご報告の id（プロフィールの一覧から来たとき）。無ければ null
  openPostId: string | null;
};

export default function MemberPosts({
  authorId,
  authorName,
  avatarUrl,
  posts,
  isMine,
  openPostId,
}: MemberPostsProps) {
  const router = useRouter();
  // ストーリーで開いているのが何枚目か。null なら一覧を見ている
  // プロフィールの一覧で押して来たときは、そのご報告を開いた状態から始めます
  const [openIndex, setOpenIndex] = useState<number | null>(() => {
    const index = posts.findIndex((post) => post.id === openPostId);
    return index === -1 ? null : index;
  });
  // 長押しで選んだご報告。null なら何も選んでいない
  const [menuPost, setMenuPost] = useState<StoryPost | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 長押しの計り方。描き直しで消えないよう useRef に入れます
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const longPressedRef = useRef(false);

  const cancelPress = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  // ホームへ戻ります。refresh は、いま見たご報告が光らなくなるように、ホームを取り直すためです
  const goHome = () => {
    router.push("/");
    router.refresh();
  };

  const handleDelete = async () => {
    if (menuPost === null) return;
    setIsDeleting(true);
    setMessage(null);

    // .select() を付けると、実際に消えた行が返ってきます。
    // 許可が無くて消えなかったときも「エラー」にはならないので、件数で確かめます
    const { data, error } = await createClient()
      .from("posts")
      .delete()
      .eq("id", menuPost.id)
      .select("id");

    setIsDeleting(false);
    if (error || data?.length !== 1) {
      setMessage("消せませんでした。supabase/04_security.sql をまだ流していないかもしれません");
      return;
    }
    setMenuPost(null);
    // 取り直して、一覧から消えた状態にします
    router.refresh();
  };

  return (
    <div className="min-h-full bg-[#faf9f6] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      {/* ▼ 上：戻るボタンと、その人のアイコン・名前（押すとプロフィールへ） */}
      <header className="sticky top-0 z-10 flex items-center gap-1 border-b border-kin/30 bg-[#faf9f6]/90 px-2 py-1 backdrop-blur">
        <button
          type="button"
          onClick={goHome}
          aria-label="ホームへ戻る"
          className="flex h-11 w-11 cursor-pointer items-center justify-center text-stone-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-7 w-7"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <Link
          href={`/members/${authorId}/profile`}
          className="flex min-h-11 min-w-0 items-center gap-2"
        >
          <span
            className="h-8 w-8 shrink-0 rounded-full bg-stone-300 bg-cover bg-center ring-2 ring-kin"
            style={avatarUrl ? { backgroundImage: `url("${encodeURI(avatarUrl)}")` } : undefined}
          />
          <span className="truncate font-bold text-stone-800">{authorName}</span>
        </Link>
      </header>

      {posts.length === 0 ? (
        <p className="py-20 text-center text-sm text-stone-500">まだご報告はありません。</p>
      ) : (
        // ▼ 3列に並べます。gap-0.5 = 写真どうしのすき間を細くして、1枚の壁のように見せます
        <ul className="grid grid-cols-3 gap-0.5">
          {posts.map((post, index) => (
            <li key={post.id}>
              <button
                type="button"
                // no-callout = iPhone で長押ししたときに出る「画像を保存」などの吹き出しを止めます
                className="no-callout relative block aspect-[9/16] w-full cursor-pointer overflow-hidden bg-stone-200 select-none"
                onPointerDown={(event) => {
                  longPressedRef.current = false;
                  startRef.current = { x: event.clientX, y: event.clientY };
                  if (!isMine) return;
                  timerRef.current = setTimeout(() => {
                    longPressedRef.current = true;
                    setMessage(null);
                    setMenuPost(post);
                  }, LONG_PRESS_MS);
                }}
                onPointerMove={(event) => {
                  const start = startRef.current;
                  if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_TOLERANCE) {
                    cancelPress();
                  }
                }}
                onPointerUp={cancelPress}
                onPointerCancel={cancelPress}
                // 長押しのメニューを出したときは、ストーリーを開きません
                onClick={() => {
                  if (!longPressedRef.current) setOpenIndex(index);
                }}
                // パソコンの右クリックのメニューも止めます
                onContextMenu={(event) => event.preventDefault()}
              >
                {post.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.imageUrl}
                    alt=""
                    draggable={false}
                    // 画面に見えている上のほうの9枚だけ、すぐ読みます
                    loading={index < 9 ? "eager" : "lazy"}
                    className="h-full w-full object-cover"
                  />
                ) : null}
                {/* 下を暗くして、白いタイトルを読めるようにします */}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-2 pt-8 text-left">
                  <span className="line-clamp-2 text-xs font-bold leading-snug text-white">
                    {post.title}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ▼ ストーリー。一覧の上にかぶせて出します */}
      {openIndex !== null ? (
        <StoryViewer
          authorId={authorId}
          authorName={authorName}
          avatarUrl={avatarUrl}
          posts={posts}
          initialIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      ) : null}

      {/* ▼ 長押しのメニュー。下から出る、iPhone でよく見る形です */}
      {menuPost !== null ? (
        <div
          className="absolute inset-0 z-50 flex items-end bg-black/40"
          onClick={() => setMenuPost(null)}
        >
          <div
            className="w-full space-y-2 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
            // メニューの中を押したときは、閉じないようにします
            onClick={(event) => event.stopPropagation()}
          >
            <div className="overflow-hidden rounded-2xl bg-white">
              <p className="truncate border-b border-stone-100 px-4 py-3 text-center text-xs text-stone-500">
                「{menuPost.title}」
              </p>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="h-14 w-full cursor-pointer text-[17px] font-bold text-beni disabled:opacity-50"
              >
                {isDeleting ? "消しています…" : "この投稿を消す"}
              </button>
            </div>
            {message ? (
              <p className="rounded-xl bg-white px-4 py-2 text-center text-xs text-beni">{message}</p>
            ) : null}
            <button
              type="button"
              onClick={() => setMenuPost(null)}
              className="h-14 w-full cursor-pointer rounded-2xl bg-white text-[17px] text-stone-700"
            >
              やめる
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
