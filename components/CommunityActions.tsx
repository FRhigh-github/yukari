// 「新しく作る」と「招待コードで参加する」をまとめた部品です。
//
// 前はフォームが2つとも出しっぱなしで、画面が縦に長くなっていました。
// 押したときだけ開く形にして、ふだんはボタン2つだけにしています。

"use client";

import { useState } from "react";
import CommunityCreateForm from "@/components/CommunityCreateForm";
import CommunityJoinForm from "@/components/CommunityJoinForm";

// null = どちらも閉じている
type OpenKind = "create" | "join" | null;

type CommunityActionsProps = {
  // 最初からどちらかを開いておきたいときに使います。
  // 切り替えシートの「＋ 新しく作る」から来たときなどです。
  initialOpen: OpenKind;
};

export default function CommunityActions({
  initialOpen,
}: CommunityActionsProps) {
  const [open, setOpen] = useState<OpenKind>(initialOpen);

  // 同じボタンをもう一度押したら閉じます
  const toggle = (kind: OpenKind) => setOpen(open === kind ? null : kind);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => toggle("create")}
        className="flex h-12 w-full items-center justify-between rounded-xl border border-stone-200 px-4 text-sm text-stone-700"
      >
        ＋ 新しく作る
        <span className="text-stone-300">{open === "create" ? "▲" : "▼"}</span>
      </button>

      {open === "create" ? <CommunityCreateForm /> : null}

      <button
        type="button"
        onClick={() => toggle("join")}
        className="flex h-12 w-full items-center justify-between rounded-xl border border-stone-200 px-4 text-sm text-stone-700"
      >
        招待コードで参加する
        <span className="text-stone-300">{open === "join" ? "▲" : "▼"}</span>
      </button>

      {open === "join" ? <CommunityJoinForm /> : null}
    </div>
  );
}
