// 「〇〇さんの復旧が申請されています」という知らせです。
//
// この仕組みの肝は、黙って乗っ取れないようにすることです。
// 3人が結託しても、申請がコミュニティ全員に見えるので、
// 心当たりのない人が1人でも止めれば通りません。
//
// 逆に、本当に困っている人の場合は誰も止めないので、24時間後に通ります。
// 「本人が気づけるかどうか」で自動的に振り分けられる、という考え方です。

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RecoveryRequest } from "@/lib/home";

type RecoveryNoticeProps = {
  requests: RecoveryRequest[];
};

export default function RecoveryNotice({ requests }: RecoveryNoticeProps) {
  const router = useRouter();

  // 「止める」を押したあと、本当に止めるか一度だけ確かめます。
  // 押し間違いで、困っている人を締め出してしまうためです。
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (requests.length === 0) return null;

  const handleVeto = async (requestId: string) => {
    setMessage(null);

    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    const { error } = await supabase
      .from("recovery_vetoes")
      .insert({ request_id: requestId, user_id: data.user.id });

    if (error) {
      console.error("復旧を止められませんでした", error);
      setMessage("止められませんでした。もう一度お試しください");
      return;
    }

    setConfirmingId(null);
    router.refresh();
  };

  return (
    <div className="space-y-2 px-4 pt-2">
      {requests.map((request) => (
        <div
          key={request.id}
          className="rounded-xl bg-[#fdf6f0] p-3 text-sm text-stone-700 ring-1 ring-beni/40"
        >
          {/* 自分への申請なら、言い方を変えます。
              ログインできている本人にとっては、身に覚えのない申請＝乗っ取りのおそれだからです */}
          {request.isMine ? (
            <p className="leading-relaxed">
              <span className="font-bold">あなたのアカウント</span>に、
              3人の力で戻る申請が出ています。
              <br />
              心当たりがなければ、すぐに止めてください。
            </p>
          ) : (
            <p className="leading-relaxed">
              <span className="font-bold">{request.targetName}</span> さんが
              アプリに入れなくなり、3人の力で戻ろうとしています。
              <br />
              心当たりがなければ、止めてください。
            </p>
          )}

          {confirmingId === request.id ? (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => handleVeto(request.id)}
                className="h-11 flex-1 cursor-pointer rounded-lg bg-beni text-sm font-bold text-white"
              >
                止める
              </button>
              <button
                type="button"
                onClick={() => setConfirmingId(null)}
                className="h-11 flex-1 cursor-pointer rounded-lg border border-stone-300 bg-white text-sm text-stone-600"
              >
                やめる
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingId(request.id)}
              className="mt-1 h-11 cursor-pointer text-sm text-beni underline"
            >
              心当たりがない（止める）
            </button>
          )}

          {message ? (
            <p className="mt-1 text-sm text-beni">{message}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
