// ご報告1件ぶんの見た目。一覧でも詳細でも、同じものを使い回せます。

import Link from "next/link";
import ReactionBoard, { type Reaction } from "@/components/ReactionBoard";

type PostCardProps = {
  id: string;
  title: string;
  body: string | null;
  createdAt: string;
  imageUrl: string | null;
  reactions: Reaction[];
};

export default function PostCard({
  id,
  title,
  body,
  createdAt,
  imageUrl,
  reactions,
}: PostCardProps) {
  return (
    <article className="mb-3 rounded-2xl bg-white p-4 shadow-sm">
      <span className="text-xs text-stone-400">
        {new Date(createdAt).toLocaleDateString("ja-JP")}
      </span>

      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="mb-3 mt-2 w-full rounded-xl bg-stone-100 object-cover"
        />
      ) : null}

      {/* 写真の下からのぞかせたいので、タイトルより先に置きます */}
      <ReactionBoard reactions={reactions} />

      <h2 className="mb-1 font-bold text-stone-800">{title}</h2>
      <p className="text-sm leading-relaxed text-stone-600">{body}</p>

      {/* ?post= で、どの報告への反応かを手書き画面に伝えます */}
      <Link
        href={`/draw?post=${id}`}
        className="mt-3 inline-block rounded-full border border-orange-300 px-4 py-1.5 text-xs text-orange-600"
      >
        反応する
      </Link>
    </article>
  );
}
