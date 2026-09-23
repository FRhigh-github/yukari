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
  // 一番上の1件かどうか。写真をすぐ読むかの判断に使います。
  isFirst?: boolean;
};

export default function PostCard({
  id,
  title,
  body,
  createdAt,
  imageUrl,
  reactions,
  isFirst = false,
}: PostCardProps) {
  return (
    // ▼ インスタのストーリーのような、縦長（9:16）の1枚にします。
    //   写真の形がばらばらだと一覧がでこぼこになるので、枠の比率を固定して、
    //   写真は枠いっぱいに切りそろえます（object-cover）。
    //   文字は写真の上に重ねて、下のほうを暗くして読めるようにしています。
    <article className="relative mb-4 aspect-[9/16] w-full overflow-hidden rounded-2xl bg-stone-800 ring-1 ring-kin/40">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          // ▼ 一番上の写真だけは、すぐ読みにいきます。
          //   開いた時点で見えているのに後回しにすると、
          //   文字だけ先に出て、写真が遅れて出てくることになります。
          //   下のほうの写真は lazy のまま（画面に出てから読みます）。
          loading={isFirst ? "eager" : "lazy"}
          fetchPriority={isFirst ? "high" : "auto"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      {/* 上と下を暗くするグラデーション。白い文字が写真に溶けないようにします */}
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

      {/* 左上に日付 */}
      <span className="absolute left-4 top-4 text-xs font-bold text-white/90">
        {new Date(createdAt).toLocaleDateString("ja-JP")}
      </span>

      {/* ▼ 下のほうに、届いたお祝い・タイトル・本文・反応するボタンを重ねます */}
      <div className="absolute inset-x-0 bottom-0 p-4">
        {/* ReactionBoard は上に食い込む作りなので、そのぶん上を空けます */}
        <div className="pt-4">
          <ReactionBoard reactions={reactions} />
        </div>

        <h2 className="mb-1 text-xl font-bold text-white">{title}</h2>
        {/* line-clamp-3 = 長い本文は3行で切って「…」にします。写真が隠れすぎないように */}
        <p className="line-clamp-3 text-sm leading-relaxed text-white/85">{body}</p>

        {/* ?post= で、どの報告への反応かを手書き画面に伝えます */}
        <div className="mt-3 flex justify-end">
          <Link
            href={`/draw?post=${id}`}
            className="flex h-11 items-center rounded-full bg-beni px-5 text-sm font-bold text-white ring-1 ring-kin ring-offset-2 ring-offset-black/0"
          >
            反応する
          </Link>
        </div>
      </div>
    </article>
  );
}
