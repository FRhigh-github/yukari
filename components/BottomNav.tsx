"use client"; // 「今どのURLにいるか」をブラウザに聞くので必要

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

// 下タブを出さない画面。ここに URL を足せば、その画面ではタブが消えます。
// /cards/new は下に道具の棚があるので、重ねると送信ボタンが隠れます。
// 作っている最中の画面なので、/draw と同じくタブは出しません。
const HIDE_NAV = [
  "/login",
  "/signup",
  "/setup",
  "/start",
  "/recover",
  "/draw",
  "/cards/new",
];

// アイコンは形（svg の中身）だけを持たせています。
// 4つとも同じ大きさ・同じ線の太さなので、囲いの部分は下で1回だけ書きます。
const TABS = [
  {
    href: "/cards",
    label: "カード",
    // 横長のカードに、小さなハートを1つ。
    // 前は縦長の四角に留め具が付いた形で、クリップボードに見えていました。
    // 横長にすると「カード」らしくなり、ハートで「気持ちを送るもの」だと分かります。
    path: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M12 15.5s-3.5-2.1-3.5-4.4A1.9 1.9 0 0 1 12 10a1.9 1.9 0 0 1 3.5 1.1c0 2.3-3.5 4.4-3.5 4.4z" />
      </>
    ),
  },
  {
    href: "/",
    label: "ホーム",
    path: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />,
  },
  {
    // 手紙を書く画面は app/letter にあるので、そちらへ向ける
    href: "/letter",
    label: "未来への手紙",
    path: <path d="M3 5h18v14H3zM3 7l9 6 9-6" />,
  },
  {
    href: "/profile",
    label: "プロフィール",
    path: <path d="M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8M4 21v-1a8 8 0 0 1 16 0v1" />,
  },
];

// ▼ アイコン1つぶん
//
// useLinkStatus は「今このリンクの移動中かどうか」を教えてくれます。
// これを使うと、次の画面ができあがるのを待たずに、
// 押した瞬間からアイコンを選択中の見た目にできます。
// 反応が無いと「押せていない」と感じるので、これが効きます。
//
// ※ useLinkStatus は <Link> の中でしか使えないので、部品を分けています。
type TabIconProps = {
  path: React.ReactNode;
  isCurrent: boolean;
};

function TabIcon({ path, isCurrent }: TabIconProps) {
  const { pending } = useLinkStatus();
  const isActive = isCurrent || pending;

  return (
    // ▼ 選ばれているタブの後ろに、白い台を敷きます。
    //   影(shadow-md)を付けると、その1つだけがバーから
    //   ふわっと持ち上がって見えます（Instagram の下タブと同じ見せ方）。
    //   色を変えるだけより「いまここにいる」がはっきりします。
    //
    //   transition = 台が出たり消えたりするときに、パッと変わらず少しなめらかにします。
    <span
      className={`flex h-10 w-14 items-center justify-center rounded-full transition-all duration-200 ${
        isActive ? "bg-white/90 shadow-md" : ""
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        // 中は塗りません。塗ると線の形がつぶれて、何の絵か分かりにくくなるためです。
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        // 色は水引から取っています（globals.css）。
        //   ふだん   = 紅(beni)
        //   選択中   = 金(kin)
        // stroke を currentColor にしてあるので、
        // ここで文字色を変えるだけで線の色が変わります。
        className={isActive ? "text-kin" : "text-beni"}
      >
        {path}
      </svg>
    </span>
  );
}

export default function BottomNav() {
  const pathname = usePathname(); // 例: '/post' のような文字列が入る

  // null を返すと何も表示されません
  if (HIDE_NAV.includes(pathname)) return null;

  return (
    // 外側の枠。ここで画面の端からの距離を作ります。
    // pb の env(safe-area-inset-bottom) は、iPhone 下端の横棒のぶんの余白です。
    //
    // absolute で中身の上に重ねています。
    // 並べて置くと後ろに何も無いので、すりガラスにしても透けません。
    // pointer-events-none/auto = 枠の余白部分を押しても反応しないようにする指定。
    // 重ねたぶん、バーの外側で中身が押せなくなるのを防ぎます。
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2">
      {/* こちらが浮いて見える本体。
          rounded-2xl で角を丸め、shadow-lg で影を落とすと、
          画面から少し持ち上がっているように見えます。 */}
      {/* backdrop-blur = 後ろにあるものをぼかす指定。
          bg-stone-200/70 の「/70」は 70% の濃さ、という意味です。
          この2つで、後ろが透けるすりガラスになります。 */}
      <nav className="pointer-events-auto flex items-center justify-around rounded-2xl bg-stone-200/70 px-2 py-1.5 shadow-lg backdrop-blur-xl">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              // 文字は出さないので、代わりに aria-label で名前を持たせます。
              // h-11 = 44px。押せる範囲を iOS の基準に合わせています。
              // 横は、中の白い台(w-14)が入るように広げてあります。
              aria-label={tab.label}
              // active:scale-90 = 指で押しているあいだ、少し縮みます。
              // 押せたことがその場で分かるので、待ち時間が気になりにくくなります。
              className="flex h-11 w-16 items-center justify-center transition-transform active:scale-90"
            >
              <TabIcon path={tab.path} isCurrent={isActive} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
