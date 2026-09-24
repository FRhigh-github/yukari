// プロフィールの画面の「ご報告」を、小さいはがきで2列に並べる部品です。
// 見た目は、ご報告の一覧（MemberPosts）と同じにそろえています。
//
// 押すと、ご報告の画面（/members/<id>）へ移り、押した写真からストーリーで開きます。
// ?post=<ご報告の id> で「どれを押したか」を伝えています。

import Link from "next/link";
import ReportPostcard from "@/components/ReportPostcard";

type PostGridProps = {
  // だれのご報告か
  memberId: string;
  posts: { id: string; title: string; imageUrl: string | null; createdAt: string }[];
};

export default function PostGrid({ memberId, posts }: PostGridProps) {
  if (posts.length === 0) {
    return <p className="py-16 text-center text-sm text-stone-500">まだご報告はありません。</p>;
  }

  return (
    // ▼ 小さい「ご報告のはがき」を2列に並べます（components/ReportPostcard.tsx）。
    //   前は写真だけを3列に詰めていましたが、ご報告ははがきの形で見せることにしたので、
    //   一覧でも同じはがきにして、タイトルと日付が読める大きさにしています
    <ul className="grid grid-cols-2 gap-3 bg-[#f3ede2] p-3">
      {posts.map((post) => (
        <li key={post.id}>
          <Link href={`/members/${memberId}?post=${post.id}`} className="block h-full">
            <ReportPostcard
              size="tile"
              title={post.title}
              createdAt={post.createdAt}
              imageUrl={post.imageUrl}
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
