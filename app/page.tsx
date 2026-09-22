import Link from "next/link";
import { redirect } from "next/navigation";
import { getHomeData } from "@/lib/home";
import MemberCircles from "@/components/MemberCircles";
import CommunitySwitcher from "@/components/CommunitySwitcher";
import PullToRefresh from "@/components/PullToRefresh";
import RecoveryNotice from "@/components/RecoveryNotice";
import HintOverlay from "@/components/HintOverlay";
import { SHOW_HINTS } from "@/lib/tutorial";

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
  // tour=1 は、アカウントを作ってから初めてホームに来た人です
  const { c, tour } = await searchParams;

  // ?c=a&c=b のように2回書かれると配列になるので、文字列のときだけ使います
  const selectedId = typeof c === "string" ? c : null;

  // currentId = 実際に見ているコミュニティ。
  // ?c= が無いときは、getHomeData が一番上を選んで返してくれます。
  const { user, communities, members, currentId, recoveryRequests, todayCount } =
    await getHomeData(selectedId);

  // ▼ ログインしていない人は、ここで追い返します。
  //
  //   前は「ログインしてください」と書いた画面を出していましたが、
  //   その前にオープニングが流れてしまい、
  //   「アニメーション → ホーム → ログイン」という順番になっていました。
  //
  //   redirect は画面を作る前に止めるので、何も表示されません。
  //   ログインが済んでから戻ってきたときに、初めて紐が流れます。
  if (user === null) redirect("/login");

  return (
    // h-full = 親（layout の main）からもらった高さいっぱい。
    // 縦に伸ばさず、この中で収める形にします。
    <div className="relative flex h-full flex-col">
      {/* shrink-0 = 場所が足りなくてもこのバーは縮めない */}
      <header className="flex shrink-0 items-center gap-3 border-b border-stone-100 px-4 py-3">
        {/* 作る・参加する・設定への入口も、この中にまとめてあります */}
        <CommunitySwitcher
          communities={communities}
          selectedId={currentId}
          memberCount={members.length}
          todayCount={todayCount}
        />

        {/* 知らせ。報告がある日は、鐘の右上に紅い点を出します。
            relative は、この点を鐘を基準に置くために必要です。 */}
        <span className="relative shrink-0 text-xl text-stone-500">
          🔔
          {todayCount > 0 ? (
            <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-beni" />
          ) : null}
        </span>
      </header>

      {/* 初めての人にだけ、一言そえます */}
      {SHOW_HINTS && tour === "1" ? (
        <HintOverlay text="まん中が自分。まわりの人を押すと、その人のご報告が見られます。" />
      ) : null}

      {/* 復旧の申請が出ていれば、いちばん上に知らせます */}
      <RecoveryNotice requests={recoveryRequests} />

      {members.length === 0 ? (
        <Notice
          text="まだコミュニティに入っていません"
          href="/communities/join"
          label="コミュニティに参加する"
        />
      ) : (
        // flex-1 = 残りの高さを全部つかう。マルはこの中に割り振られます。
        // 上から引っぱると、中身を取り直せます。
        //
        // pb は、下タブと2つのボタンが重なっているぶんの逃げです。
        // これが無いと、相関図の中心が「隠れている部分まで含めた真ん中」になり、
        // 上に大きな余白ができてしまいます。
        <div className="min-h-0 flex-1 px-3 pb-[calc(env(safe-area-inset-bottom)+7rem)]">
          <PullToRefresh>
            <MemberCircles members={members} currentUserId={user.id} />
          </PullToRefresh>
        </div>
      )}

      {/* 左下：届いたカードを見る手紙ボックス
          下タブ（約76px）＋ iPhone下端の余白 の上に置きます。
          余白を足さずに数字だけで決めると、端末によって重なります。 */}
      <Link
        href="/cards/inbox"
        aria-label="届いたカード"
        className="absolute bottom-[calc(env(safe-area-inset-bottom)+6rem)] left-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg"
      >
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-stone-600"
        >
          {/* 郵便受けの形。箱と、差し込み口と、旗 */}
          <path d="M3 11h14a2 2 0 0 1 2 2v7H3z" />
          <path d="M6 14h5" />
          <path d="M19 13V5h-4" />
        </svg>
      </Link>

      {/* 右下：ご報告を書く */}
      <Link
        href="/post"
        className="absolute bottom-[calc(env(safe-area-inset-bottom)+6rem)] right-4 z-30 rounded-full bg-stone-400 px-5 py-2.5 text-xs font-bold text-white shadow-lg"
      >
        ステキな報告をする
      </Link>
    </div>
  );
}
