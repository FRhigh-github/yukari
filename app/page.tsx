import Link from "next/link";
import { getHomeData } from "@/lib/home";
import MemberCircles from "@/components/MemberCircles";
import CommunitySwitcher from "@/components/CommunitySwitcher";

// 画面の真ん中に、文と案内ボタンを1つ出すだけの小さな部品
function Notice({ text, href, label }: { text: string; href: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-20">
      <p className="text-sm text-stone-500">{text}</p>
      <Link
        href={href}
        className="rounded-full bg-stone-800 px-6 py-3 text-sm font-bold text-white"
      >
        {label}
      </Link>
    </div>
  );
}

// searchParams = URL の ? より後ろ。/?c=xxxx の xxxx を受け取ります。
export default async function Home({ searchParams }: PageProps<"/">) {
  const { c } = await searchParams;

  // ?c=a&c=b のように2回書かれると配列になるので、文字列のときだけ使います
  const selectedId = typeof c === "string" ? c : null;

  const { user, communities, members } = await getHomeData(selectedId);

  if (user === null) {
    return <Notice text="ログインしてください" href="/login" label="ログインへ" />;
  }

  return (
    <div className="relative">
      <header className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
        <CommunitySwitcher communities={communities} selectedId={selectedId} />
        <span className="text-sm text-stone-400">🔔</span>
      </header>

      {members.length === 0 ? (
        <Notice
          text="まだコミュニティに入っていません"
          href="/join"
          label="招待コードで参加する"
        />
      ) : (
        <div className="px-3 pb-24">
          <MemberCircles members={members} />
        </div>
      )}

      {/* sticky bottom-5 = スクロールしても画面の下に残ります。
          pointer-events-none / auto = ボタン以外は押せない扱いにして、
          透明な帯がマルにかぶさるのを防いでいます。 */}
      <div className="pointer-events-none sticky bottom-5 flex justify-end px-5">
        <Link
          href="/post"
          className="pointer-events-auto rounded-full bg-stone-400 px-5 py-2.5 text-xs font-bold text-white shadow-lg"
        >
          ステキな報告をする
        </Link>
      </div>
    </div>
  );
}
