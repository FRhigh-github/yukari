'use client'   // 「今どのURLにいるか」をブラウザに聞くので必要

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/', label: 'ホーム', icon: HomeIcon },
  { href: '/cards', label: 'カード' },
  { href: '/capsules', label: '未来への手紙' },
  { href: '/profile', label: 'プロフィール' },
]

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  )
}

export default function BottomNav() {
  const pathname = usePathname()   // 例: '/post' のような文字列が入る

  return (
    <nav className="flex border-t border-amber-200 bg-amber-50">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href   // 今いるタブかどうか
        const Icon = tab.icon

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-xs ${
              isActive ? 'font-bold text-orange-600' : 'text-stone-500'
            }`}
          >
            {Icon ? <Icon active={isActive} /> : tab.label}
          </Link>
        )
      })}
    </nav>
  )
}