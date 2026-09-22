// パスワードの入力欄です。右端の目印を押すと、中身が見えます。
//
// スマホは打ち間違いが多いので、確かめられないと入れ直しになります。
// 見えている間は type="text" にしているだけの、単純な作りです。

"use client";

import { useState } from "react";

type PasswordFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  // 新しく決めるときは6文字以上、ログインのときは制限なし
  minLength?: number;
};

export default function PasswordField({
  value,
  onChange,
  placeholder,
  minLength,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <input
        required
        type={isVisible ? "text" : "password"}
        minLength={minLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-stone-800 focus:outline-none"
      />

      <button
        type="button"
        onClick={() => setIsVisible(!isVisible)}
        // 目で見て分かるように、状態を文字でも伝えます
        aria-label={isVisible ? "パスワードを隠す" : "パスワードを表示"}
        // h-11 w-11 = 44px。押せる範囲を iOS の基準に合わせています
        className="-mr-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center text-stone-400"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* 目の形。見えている間は、上に斜線を重ねます */}
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
          <circle cx="12" cy="12" r="2.5" />
          {isVisible ? <path d="M3 21 21 3" /> : null}
        </svg>
      </button>
    </div>
  );
}
