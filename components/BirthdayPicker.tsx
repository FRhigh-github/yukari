// 誕生日を「月」と「日」だけで選ぶ部品です。
//
// 標準の日付入力（type="date"）だと年まで聞くことになります。
// このアプリで誕生日を出す場面は「6月18日」だけなので、年は要りません。
// 生まれ年は人に知られたくない情報でもあるので、最初から持たない形にします。
//
// ▼ 保存の形について
//   DBの列は date（年月日）なので、年の場所が空のままでは入りません。
//   そこで 2000年 と決め打ちして入れています。
//   表示側は月と日しか見ないので、年は使われません。

"use client";

import { useState } from "react";

export const BIRTHDAY_YEAR = "2000";

type BirthdayPickerProps = {
  // "2000-06-18" の形。まだ選んでいなければ空文字
  value: string;
  onChange: (value: string) => void;
};

// 1〜12、1〜31 の並びを作ります。
// Array.from({length: n}, (_, i) => ...) は「n個の並びを作る」書き方です。
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export default function BirthdayPicker({
  value,
  onChange,
}: BirthdayPickerProps) {
  // "2000-06-18" を ["2000", "06", "18"] に分けて、月と日を取り出します
  const parts = value.split("-");

  // ▼ 月と日は、それぞれ別に覚えます。
  //
  //   前は親から渡された日付だけを見ていました。
  //   ところが「月だけ」では日付にならないので親に伝えられず、
  //   伝えられない＝表示も変わらないため、選んだ月がすぐ戻ってしまい、
  //   いつまでも決められない状態になっていました。
  const [month, setMonth] = useState(parts[1] ?? "");
  const [day, setDay] = useState(parts[2] ?? "");

  // 両方そろったときだけ、日付の形にして親へ渡します
  const report = (nextMonth: string, nextDay: string) => {
    if (nextMonth === "" || nextDay === "") return;
    onChange(`${BIRTHDAY_YEAR}-${nextMonth}-${nextDay}`);
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={month}
        onChange={(next) => {
          setMonth(next);
          report(next, day);
        }}
        options={MONTHS}
        unit="月"
      />
      <Select
        value={day}
        onChange={(next) => {
          setDay(next);
          report(month, next);
        }}
        options={DAYS}
        unit="日"
      />
    </div>
  );
}

// 選ぶところ1つぶん。
// スマホでは、これを押すと下からくるくる回る選択盤が出ます。
type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: number[];
  unit: string;
};

function Select({ value, onChange, options, unit }: SelectProps) {
  return (
    <div className="flex items-center gap-1">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // h-11 = 44px。押せる範囲を iOS の基準に合わせています
        className="h-11 cursor-pointer rounded-lg bg-stone-100 px-3 text-sm text-stone-800 focus:outline-none"
      >
        <option value="">--</option>
        {options.map((option) => (
          // 値は "06" の形、見た目は "6" にします
          <option key={option} value={String(option).padStart(2, "0")}>
            {option}
          </option>
        ))}
      </select>
      <span className="text-sm text-stone-600">{unit}</span>
    </div>
  );
}
