// 相手のプロフィールのいちばん下に置く「報告する」「ブロックする」です。
//
//   報告する   … 理由を書いて送ると、二人が一緒にいるコミュニティの作成者に届きます
//                （コミュニティの設定の画面で読めます。supabase/01_schema.sql の report_user）
//   ブロックする … その人のご報告・お祝い・カードが、自分に見えなくなります。
//                その人は、自分にカードを送れなくなります。相手には知らされません
//
// ふだんは使わないものなので、小さな文字のボタンにして、押したときだけ中身を出します。

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type MemberSafetyActionsProps = {
  targetUserId: string;
  targetName: string;
  // もうブロックしているか
  isBlocked: boolean;
};

export default function MemberSafetyActions({
  targetUserId,
  targetName,
  isBlocked,
}: MemberSafetyActionsProps) {
  const router = useRouter();
  // 開いている欄。"report" = 報告を書く / "block" = ブロックの確かめ / null = 閉じている
  const [mode, setMode] = useState<"report" | "block" | null>(null);
  const [reason, setReason] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleReport = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSending(true);
    setMessage(null);
    const { data, error } = await createClient().rpc("report_user", {
      target_user: targetUserId,
      reason,
    });
    setIsSending(false);
    if (error || typeof data !== "number" || data === 0) {
      console.error("報告できませんでした", error);
      setMessage("送れませんでした。時間をおいて、もう一度お試しください");
      return;
    }
    setReason("");
    setMode(null);
    setMessage("コミュニティの作成者に届けました");
  };

  const handleBlock = async () => {
    setIsSending(true);
    setMessage(null);
    const supabase = createClient();
    const { data } = await supabase.auth.getClaims();
    const myId = data?.claims.sub;
    if (!myId) return;

    // ブロックしていれば外し、していなければ入れます
    const { error } = isBlocked
      ? await supabase.from("blocks").delete().eq("blocker", myId).eq("blocked", targetUserId)
      : await supabase.from("blocks").insert({ blocker: myId, blocked: targetUserId });

    setIsSending(false);
    if (error) {
      console.error("ブロックを変えられませんでした", error);
      setMessage("できませんでした。もう一度お試しください");
      return;
    }
    setMode(null);
    // 画面を取り直して、見えるご報告を入れ替えます
    router.refresh();
  };

  return (
    <div className="space-y-3 px-4 pt-8">
      <div className="flex justify-center gap-6">
        <button
          type="button"
          onClick={() => setMode(mode === "report" ? null : "report")}
          className="h-11 px-2 text-sm text-stone-500 underline"
        >
          報告する
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "block" ? null : "block")}
          className="h-11 px-2 text-sm text-stone-500 underline"
        >
          {isBlocked ? "ブロックをやめる" : "ブロックする"}
        </button>
      </div>

      {mode === "report" ? (
        <form onSubmit={handleReport} className="space-y-2">
          <textarea
            required
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={`${targetName}さんの、困っていること`}
            className="h-28 w-full resize-none rounded-xl border border-kin/30 bg-white p-3 text-base text-stone-700 placeholder:text-stone-400 focus:border-kin focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSending}
            className="h-11 w-full rounded-xl bg-beni text-sm font-bold text-white disabled:opacity-50"
          >
            {isSending ? "送っています…" : "作成者に送る"}
          </button>
        </form>
      ) : null}

      {mode === "block" ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleBlock}
            disabled={isSending}
            className="h-11 flex-1 rounded-xl bg-beni text-sm font-bold text-white disabled:opacity-50"
          >
            {isBlocked ? "ブロックをやめる" : `${targetName}さんをブロック`}
          </button>
          <button
            type="button"
            onClick={() => setMode(null)}
            className="h-11 flex-1 rounded-xl border border-stone-300 bg-white text-sm text-stone-600"
          >
            やめる
          </button>
        </div>
      ) : null}

      {message ? <p className="text-center text-sm text-stone-600">{message}</p> : null}
    </div>
  );
}
