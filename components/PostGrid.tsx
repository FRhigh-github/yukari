// プロフィールの画面の「ご報告」を、縦長の写真で3列に並べる部品です。
// 見た目は、ご報告の一覧（MemberPosts）と同じにそろえています。
//
// 押すと、ご報告の画面（/members/<id>）へ移り、押した写真からストーリーで開きます。
// ?post=<ご報告の id> で「どれを押したか」を伝えています。

import Link from "next/link";

type PostGridProps = {
  // だれのご報告か
  memberId: string;
  posts: { id: string; title: string; imageUrl: string | null }[];
};

export default function PostGrid({ memberId, posts }: PostGridProps) {
  if (posts.length === 0) {
    return <p className="py-16 text-center text-sm text-stone-500">まだご報告はありません。</p>;
  }

  return (
    // gap-0.5 = 写真どうしのすき間を細くして、1枚の壁のように見せます
    <ul className="grid grid-cols-3 gap-0.5">
      {posts.map((post, index) => (
        <li key={post.id}>
          <Link
            href={`/members/${memberId}?post=${post.id}`}
            className="relative block aspect-[9/16] overflow-hidden bg-stone-200"
          >
            {post.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.imageUrl}
                alt=""
                // 画面に見えている上のほうの6枚だけ、すぐ読みます
                loading={index < 6 ? "eager" : "lazy"}
                className="h-full w-full object-cover"
              />
            ) : null}
            {/* 下を暗くして、白いタイトルを読めるようにします */}
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-2 pt-8">
              <span className="line-clamp-2 text-xs font-bold leading-snug text-white">
                {post.title}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
