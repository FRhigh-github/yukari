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
      setMessage("止められませんでした: " + error.message);
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
          className="rounded-xl bg-amber-50 p-3 text-xs text-stone-700"
        >
          <p className="leading-relaxed">
            <span className="font-bold">{request.targetName}</span> さんが
            アプリに入れなくなり、3人の力で戻ろうとしています。
            <br />
            心当たりがなければ、止めてください。
          </p>

          {confirmingId === request.id ? (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => handleVeto(request.id)}
                className="flex-1 cursor-pointer rounded-lg bg-red-600 py-2 text-[11px] font-bold text-white"
              >
                止める
              </button>
              <button
                type="button"
                onClick={() => setConfirmingId(null)}
                className="flex-1 cursor-pointer rounded-lg border border-stone-300 py-2 text-[11px] text-stone-600"
              >
                やめる
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingId(request.id)}
              className="mt-2 cursor-pointer text-[11px] text-red-600 underline"
            >
              心当たりがない（止める）
            </button>
          )}

          {message ? (
            <p className="mt-1 text-[11px] text-red-600">{message}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
