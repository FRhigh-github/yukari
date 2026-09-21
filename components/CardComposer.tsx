"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CardTemplate, { type CardKind } from "@/components/CardTemplate";

// 宛先の候補。同じ人が複数のコミュニティにいることがあるので、
// 「誰に」と「どのコミュニティで」を組にして持ちます。
export type Recipient = {
  userId: string;
  communityId: string;
  displayName: string | null;
  communityName: string;
};

type CardComposerProps = {
  templateId: string;
  kind: CardKind;
  name: string;
  recipients: Recipient[];
};

export default function CardComposer({
  templateId,
  kind,
  name,
  recipients,
}: CardComposerProps) {
  const router = useRouter();

  // value は「誰に|どのコミュニティで」をつないだ文字列にします。
  // select は文字列しか持てないので、2つを1つにまとめる必要があるためです。
  const [target, setTarget] = useState(
    recipients[0] ? `${recipients[0].userId}|${recipients[0].communityId}` : "",
  );
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!target) {
      setError("送る相手を選んでください");
      return;
    }

    setIsSending(true);

    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.push("/login");
      return;
    }

    // split("|") で、つないだ文字列を2つに戻します
    const [toUser, communityId] = target.split("|");

    const { error: insertError } = await supabase.from("card_sends").insert({
      template_id: templateId,
      from_user: data.user.id,
      to_user: toUser,
      community_id: communityId,
      message,
    });

    if (insertError) {
      setError("送信に失敗しました: " + insertError.message);
      setIsSending(false);
      return;
    }

    router.push("/cards");
    router.refresh();
  };

  return (
    <form onSubmit={handleSend} className="flex h-full flex-col">
      {/* 上半分：カードの見た目 */}
      <div className="flex flex-1 items-center justify-center bg-[#f6f1e7] p-6">
        <CardTemplate
          kind={kind}
          name={name}
          className="h-72 w-full max-w-[16rem] shadow-lg"
        />
      </div>

      {/* 下半分：入力 */}
      <div className="space-y-3 border-t border-stone-200 p-5">
        <label className="block text-xs text-stone-500">
          送る相手
          <select
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            className="mt-1 w-full rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-700 focus:outline-none"
          >
            {recipients.length === 0 ? (
              <option value="">送れる相手がいません</option>
            ) : null}
            {recipients.map((recipient) => (
              <option
                key={`${recipient.userId}|${recipient.communityId}`}
                value={`${recipient.userId}|${recipient.communityId}`}
              >
                {recipient.displayName ?? "名無し"}（{recipient.communityName}）
              </option>
            ))}
          </select>
        </label>

        <textarea
          placeholder="ひとこと（任意）"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="h-20 w-full resize-none rounded-xl border border-stone-200 p-3 text-sm focus:outline-none"
        />

        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={isSending || recipients.length === 0}
          className="w-full rounded-full bg-stone-800 py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          {isSending ? "送信中..." : "カードを送る"}
        </button>
      </div>
    </form>
  );
}
