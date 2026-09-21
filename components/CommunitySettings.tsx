"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CommunitySettingsProps = {
  communityId: string;
  currentName: string;
  // 作成者だけ名前を変えられるので、その判定を親から受け取ります
  isOwner: boolean;
};

export default function CommunitySettings({
  communityId,
  currentName,
  isOwner,
}: CommunitySettingsProps) {
  const router = useRouter();

  const [name, setName] = useState(currentName);
  const [message, setMessage] = useState<string | null>(null);

  // 退出を2段階にするための状態。
  // いきなり消えると事故になるので、1回目は確認に変わるだけにします。
  const [isConfirming, setIsConfirming] = useState(false);

  const handleRename = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    const supabase = createClient();

    // ▼ 最後の .select() が大事です。
    // RLS に止められても、Supabase は「エラー」ではなく
    // 「0件変更しました」として返してきます。
    // .select() を付けると、実際に変わった行が返ってくるので、
    // 中身が空かどうかで成否を判定できます。
    const { data: updated, error } = await supabase
      .from("communities")
      .update({ name })
      .eq("id", communityId)
      .select("id");

    if (error || updated?.length === 0) {
      setMessage(
        "変更できませんでした。supabase/policies_communities.sql をまだ流していないかもしれません",
      );
      return;
    }

    setMessage("変更しました");
    router.refresh();
  };

  const handleLeave = async () => {
    setMessage(null);

    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.push("/login");
      return;
    }

    // 自分の参加情報を消す＝退出、という作りです。
    // 変更のときと同じで、.select() を付けて実際に消えたか確かめます。
    const { data: deleted, error } = await supabase
      .from("memberships")
      .delete()
      .eq("community_id", communityId)
      .eq("user_id", data.user.id)
      .select("user_id");

    if (error || deleted?.length === 0) {
      setMessage(
        "退出できませんでした。supabase/policies_communities.sql をまだ流していないかもしれません",
      );
      setIsConfirming(false);
      return;
    }

    router.push("/communities");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {isOwner ? (
        <section>
          <h2 className="mb-2 text-sm font-bold text-stone-600">名前を変える</h2>
          <form onSubmit={handleRename} className="flex gap-2">
            <input
              required
              maxLength={40}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="flex-1 rounded-xl border border-stone-200 px-4 py-2.5 text-sm focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-stone-800 px-4 text-sm font-bold text-white"
            >
              保存
            </button>
          </form>
        </section>
      ) : null}

      <section>
        {isConfirming ? (
          <div className="space-y-2">
            <p className="text-xs text-stone-600">
              このコミュニティから退出します。よろしいですか？
              {isOwner ? "（あなたは作成者です）" : ""}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleLeave}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white"
              >
                退出する
              </button>
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                className="flex-1 rounded-xl border border-stone-300 py-2.5 text-sm text-stone-600"
              >
                やめる
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsConfirming(true)}
            className="text-xs text-red-600"
          >
            このコミュニティから退出する
          </button>
        )}
      </section>

      {message ? <p className="text-xs text-stone-500">{message}</p> : null}
    </div>
  );
}
