// コミュニティの作成者（owner）だけが使う道具です。コミュニティの設定の画面に置きます。
//
//   RemoveMemberButton … メンバーを外すボタン（メンバーの一覧の各行）
//   ReportList         … メンバーから届いた報告の一覧
//
// 外す・報告を消す の判定は DB がします（supabase/01_schema.sql の remove_member / reports の許可）。
// 作成者でない人が押しても、DB が止めます。

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ▼ メンバーを外すボタン。押し間違えないよう、1回目は確認に変わるだけにします
export function RemoveMemberButton({
  communityId,
  userId,
  name,
}: {
  communityId: string;
  userId: string;
  name: string;
}) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleRemove = async () => {
    setIsSending(true);
    const { data, error } = await createClient().rpc("remove_member", {
      target_community: communityId,
      target_user: userId,
    });
    setIsSending(false);
    if (error || data !== true) {
      console.error("メンバーを外せませんでした", error);
      return;
    }
    setIsConfirming(false);
    router.refresh();
  };

  if (isConfirming) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={handleRemove}
          disabled={isSending}
          aria-label={`${name}さんを外す`}
          className="h-11 rounded-lg bg-beni px-3 text-xs font-bold text-white disabled:opacity-50"
        >
          外す
        </button>
        <button
          type="button"
          onClick={() => setIsConfirming(false)}
          className="h-11 px-2 text-xs text-stone-500"
        >
          やめる
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsConfirming(true)}
      aria-label={`${name}さんをコミュニティから外す`}
      className="h-11 shrink-0 px-2 text-xs text-stone-400 underline"
    >
      外す
    </button>
  );
}

export type ReportItem = {
  id: string;
  reportedUserId: string;
  reportedName: string;
  reporterName: string;
  reason: string;
  createdAt: string;
  // 報告された人が、まだこのコミュニティにいるか（いなければ「外す」を出しません）
  isStillMember: boolean;
};

// ▼ 届いた報告の一覧。読み終えたものは「閉じる」で消せます
export function ReportList({
  communityId,
  reports,
}: {
  communityId: string;
  reports: ReportItem[];
}) {
  const router = useRouter();

  const handleClose = async (reportId: string) => {
    const { error } = await createClient().from("reports").delete().eq("id", reportId);
    if (error) {
      console.error("報告を閉じられませんでした", error);
      return;
    }
    router.refresh();
  };

  return (
    <section>
      <h2 className="mb-2 text-sm font-bold text-kin">届いた報告（{reports.length}件）</h2>
      <ul className="space-y-2">
        {reports.map((report) => (
          <li key={report.id} className="rounded-xl bg-white p-3 ring-1 ring-beni/30">
            <p className="text-sm text-stone-800">
              <span className="font-bold">{report.reportedName}</span>さんについて
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">
              {report.reason}
            </p>
            <p className="mt-1 text-xs text-stone-400">
              {report.reporterName}さんより・
              {new Date(report.createdAt).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
            </p>
            <div className="mt-2 flex items-center justify-end gap-2">
              {report.isStillMember ? (
                <RemoveMemberButton
                  communityId={communityId}
                  userId={report.reportedUserId}
                  name={report.reportedName}
                />
              ) : null}
              <button
                type="button"
                onClick={() => handleClose(report.id)}
                className="h-11 px-3 text-xs text-stone-500 underline"
              >
                閉じる
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
