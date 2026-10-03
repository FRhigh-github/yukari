// 未来への手紙に付ける「イベント（日程調整）」を作るパネルです（app/letter/page.tsx から開きます）。
//
// イベント名と候補日を入れて「決定」を押すと、onSave で手紙の画面に渡します。
// 候補日は「1日」か「期間」で入れられ、期間は1日ずつに分けてから渡します（expandRow）。
// 手紙の画面のファイルが長くなりすぎたので、パネルだけをこのファイルに分けました。

"use client";

import { useState } from "react";
import {
  CalendarIcon,
  expandRow,
  type DateRow,
  type EventDraft,
  type EventPlan,
} from "./letterParts";

type EventPanelProps = {
  // 決定済みのイベント。まだ作っていなければ null
  plan: EventPlan | null;
  onSave: (plan: EventPlan) => void;
  onRemove: () => void;
  onClose: () => void;
};

export default function EventPanel({ plan, onSave, onRemove, onClose }: EventPanelProps) {
  // パネルで入力中のイベント。
  // 決めたあとの候補日は1日ずつになっているので、開くときは1日ずつの行に戻します
  const [draft, setDraft] = useState<EventDraft>(() =>
    plan === null
      ? { name: "", rows: [{ start: "", end: "", isRange: false }] }
      : {
          name: plan.name,
          rows: plan.dates.map((d) => ({ start: d, end: "", isRange: false })),
        },
  );

  // ----- 候補日の行を1つだけ書き換える -----
  function updateRow(index: number, changes: Partial<DateRow>) {
    setDraft({
      ...draft,
      rows: draft.rows.map((row, i) => (i === index ? { ...row, ...changes } : row)),
    });
  }

  // 入力済みの候補日だけを取り出します(空の入力欄は除く)
  // (期間の行は、1日ずつに分けてから数えます)
  const filledDates = draft.rows.flatMap(expandRow);

  // 同じ日が2回入っていないかを調べます
  const hasDuplicate = new Set(filledDates).size !== filledDates.length;

  // 「決定」を押してよいかどうか
  const canSaveEvent =
    draft.name.trim() !== "" &&
    filledDates.length > 0 &&
    !hasDuplicate;

  // ----- 決定する -----
  function saveEvent() {
    if (!canSaveEvent) {
      return;
    }
    onSave({
      name: draft.name.trim(),
      dates: [...filledDates].sort(),
    });
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      // absolute = アプリの枠(スマホ幅)の中だけに重ねます。前は fixed で、PC では画面全体を覆っていました。
      // z-50 = 下タブ(z-40)より手前。前は z-10 で、決定ボタンが下タブの裏に隠れていました
      className="absolute inset-0 z-50 flex items-end justify-center bg-black/30"
    >
      <div className="max-h-[80vh] w-full max-w-[430px] overflow-y-auto rounded-t-2xl bg-[#fdfbf5] p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <p className="mb-4 flex items-center gap-2 font-bold">
          {CalendarIcon}
          イベントを企画する
        </p>

        {/* イベント名 */}
        <label className="mb-1 block text-xs text-stone-500">イベント名</label>
        <input
          type="text"
          value={draft.name}
          autoFocus
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="例：飲み会"
          className="mb-4 w-full border-b border-stone-300 bg-transparent py-1 outline-none placeholder:text-stone-300"
        />

        {/* 候補日 */}
        <p className="mb-1 text-xs text-stone-500">イベント候補日</p>
        {draft.rows.map((row, index) => (
          <div key={index} className="mb-3">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={row.start}
                onChange={(e) => updateRow(index, { start: e.target.value })}
                aria-label="候補日"
                className="h-11 min-w-0 flex-1 border-b border-stone-300 bg-transparent text-base outline-none"
              />
              {/* 期間のときだけ、終わりの日の欄を出します */}
              {row.isRange && (
                <>
                  <span className="text-stone-500">〜</span>
                  <input
                    type="date"
                    value={row.end}
                    min={row.start}
                    onChange={(e) => updateRow(index, { end: e.target.value })}
                    aria-label="期間の終わりの日"
                    className="h-11 min-w-0 flex-1 border-b border-stone-300 bg-transparent text-base outline-none"
                  />
                </>
              )}
              {draft.rows.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, rows: draft.rows.filter((_, i) => i !== index) })
                  }
                  aria-label="この候補日を消す"
                  className="flex h-11 w-11 shrink-0 items-center justify-center text-xl text-stone-500"
                >
                  ×
                </button>
              )}
            </div>
            {/* 1日 / 期間 の切り替え */}
            <div className="mt-1 flex gap-1">
              {[false, true].map((isRange) => (
                <button
                  key={String(isRange)}
                  type="button"
                  onClick={() => updateRow(index, { isRange, end: isRange ? row.end : "" })}
                  className={`h-9 rounded-full px-3 text-sm ${
                    row.isRange === isRange
                      ? "bg-white font-bold text-kin ring-1 ring-kin"
                      : "text-stone-500"
                  }`}
                >
                  {isRange ? "期間" : "1日"}
                </button>
              ))}
            </div>
          </div>
        ))}

        {hasDuplicate && (
          <p className="mb-2 text-xs text-beni">同じ日が入っています</p>
        )}

        <button
          type="button"
          onClick={() =>
            setDraft({ ...draft, rows: [...draft.rows, { start: "", end: "", isRange: false }] })
          }
          className="mb-6 h-11 rounded-full border border-kin/60 px-4 text-sm text-kin"
        >
          ＋ 候補日を追加
        </button>

        {/* 決定・キャンセル */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-stone-300 text-sm text-stone-600"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={saveEvent}
            disabled={!canSaveEvent}
            className="h-11 flex-1 rounded-xl bg-beni text-sm font-bold text-white disabled:opacity-40"
          >
            決定
          </button>
        </div>

        {plan !== null && (
          <button
            type="button"
            onClick={onRemove}
            className="mt-3 h-11 w-full text-xs text-beni"
          >
            イベントを削除
          </button>
        )}
      </div>
    </div>
  );
}
