import Link from "next/link";
import { redirect } from "next/navigation";
import { getHomeData } from "@/lib/home";
import CommunitySwitcher from "@/components/CommunitySwitcher";
import MemberCircles from "@/components/MemberCircles";
import RecoveryNotice from "@/components/RecoveryNotice";
import HintOverlay from "@/components/HintOverlay";
import NotificationToggle from "@/components/NotificationToggle";
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
    // bg-[#faf9f6] = 少し温かみのある白。オープニングの背景と同じ色です。
    // 真っ白より紙に近く、水引の紅がなじみます。
    <div className="relative flex h-full flex-col bg-[#faf9f6]">
      {/* shrink-0 = 場所が足りなくてもこのバーは縮めない */}
      <header className="flex shrink-0 items-center gap-3 border-b border-kin/30 px-4 py-3">
        {/* 作る・参加する・設定への入口も、この中にまとめてあります */}
        <CommunitySwitcher
          communities={communities}
          selectedId={currentId}
          memberCount={members.length}
          todayCount={todayCount}
        />

        {/* 通知のオン・オフ。報告がある日は、鐘の右上に紅い点が出ます */}
        <NotificationToggle hasNews={todayCount > 0} />
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
        // ▼ メンバーのアイコンを、自分を中心にした同心円に並べます（MemberCircles）。
        //   ばらばらに散らす版（components/MemberScatter.tsx）と、
        //   梅結びの模様（components/MizuhikiHome.tsx）は、いまは使っていません。
        //
        // flex-1 = 残りの高さを全部つかう。
        // 上から引っぱって取り直す動き（PullToRefresh）は外しました。
        // 指1本で模様を動かす操作と、同じ動きでぶつかるためです。
        // pb は、下タブと2つのボタンが重なっているぶんの逃げです。
        <div className="min-h-0 flex-1 px-3 pb-[calc(env(safe-area-inset-bottom)+7rem)]">
          <MemberCircles members={members} currentUserId={user.id} />
        </div>
      )}

      {/* ▼ 下の2つのボタン。どちらもアイコンだけの丸いボタンです。
            言葉を添えると、よく見るテンプレートの形になってしまうため、外しています。
            何のボタンかは aria-label（読み上げ用の名前）で伝えます。
            アイコンは下タブと同じ描き方（線の太さ2・角は丸く・塗りなし）です。

            色は水引の紅・金と、白・グレーだけにしています。
              ふみばこ = 白地に金のふちとアイコン。見るだけの、控えめなボタン
              報告する = 紅地。まわりに金の細い輪を回して、水引の紅白と金のように見せます

            下タブ（約76px）＋ iPhone下端の余白 の上に置きます。
            余白を足さずに数字だけで決めると、端末によって重なります。 */}

      {/* 左下：届いたカードを見る「ふみばこ」（文箱＝手紙を入れておく和の箱） */}
      <Link
        href="/cards/inbox"
        aria-label="ふみばこ（届いたカード）"
        className="absolute bottom-[calc(env(safe-area-inset-bottom)+6rem)] left-4 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-kin/60 bg-white shadow-md"
      >
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-kin"
        >
          {/* 箱と、上から差し込まれた手紙 */}
          <path d="M3 12h5l1.5 2.5h5L16 12h5" />
          <path d="M3 12v7h18v-7l-2.5-6h-13z" />
          <path d="M9 9h6" />
        </svg>
      </Link>

      {/* 右下：ご報告を書く */}
      <Link
        href="/post"
        aria-label="報告する"
        className="absolute bottom-[calc(env(safe-area-inset-bottom)+6rem)] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-beni text-white shadow-md ring-1 ring-kin ring-offset-2 ring-offset-[#faf9f6]"
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* 筆（ペン）の形。斜めの軸と、先の小さな線 */}
          <path d="M4 20h4L19 9l-4-4L4 16z" />
          <path d="M14 6l4 4" />
        </svg>
      </Link>
    </div>
  );
}
