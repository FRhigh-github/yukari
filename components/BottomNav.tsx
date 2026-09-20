"use client"; // 「今どのURLにいるか」をブラウザに聞くので必要

import Link from "next/link";
import { usePathname } from "next/navigation";

// 下タブを出さない画面。ここに URL を足せば、その画面ではタブが消えます。
const HIDE_NAV = ["/login", "/draw"];

// アイコンは形（svg の中身）だけを持たせています。
// 4つとも同じ大きさ・同じ線の太さなので、囲いの部分は下で1回だけ書きます。
const TABS = [
  {
    href: "/cards",
    label: "カード",
    path: <path d="M4 3h16v18H4zM8 3v3h8V3" />,
  },
  {
    href: "/",
    label: "ホーム",
    path: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />,
  },
  {
    href: "/capsules",
    label: "未来への手紙",
    path: <path d="M3 5h18v14H3zM3 7l9 6 9-6" />,
  },
  {
    href: "/profile",
    label: "プロフィール",
    path: <path d="M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8M4 21v-1a8 8 0 0 1 16 0v1" />,
  },
];

export default function BottomNav() {
  const pathname = usePathname(); // 例: '/post' のような文字列が入る

  // null を返すと何も表示されません
  if (HIDE_NAV.includes(pathname)) return null;

  return (
    // pb-[env(safe-area-inset-bottom)] = iPhone 下端の横棒に
    // タブが重ならないよう、その高さぶん余白を足します
    <nav className="flex border-t border-amber-200 bg-amber-50 pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
              isActive ? "font-bold text-orange-600" : "text-stone-500"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              // 選ばれているタブだけ、中を塗りつぶします
              fill={isActive ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {tab.path}
            </svg>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
