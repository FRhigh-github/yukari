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

    // ▼ 名前は、メンバーなら誰でも変えられます。
    //   表を直接書き換えるのは作成者しかできないので、
    //   名前だけを変える DB の関数（supabase/04_security.sql の rename_community）を呼びます
    const { error } = await supabase.rpc("rename_community", {
      target_community: communityId,
      new_name: name,
    });

    if (error) {
      setMessage("変更できませんでした");
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

    // 退出したので、もうこのコミュニティのホームには戻れません。
    // ホームへ送ると、残っているコミュニティが選び直されます。
    router.push("/");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* 名前の変更は、メンバーなら誰でもできます */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-kin">名前を変える</h2>
        <form onSubmit={handleRename} className="flex gap-2">
          <input
            required
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-11 flex-1 rounded-xl border border-kin/30 bg-white px-4 text-[17px] focus:border-kin focus:outline-none"
          />
          <button
            type="submit"
            className="h-11 shrink-0 rounded-xl border border-kin bg-white px-4 text-sm font-bold text-kin"
          >
            保存
          </button>
        </form>
      </section>

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
                className="h-11 flex-1 rounded-xl bg-beni text-sm font-bold text-white"
              >
                退出する
              </button>
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                className="h-11 flex-1 rounded-xl border border-stone-300 bg-white text-sm text-stone-600"
              >
                やめる
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsConfirming(true)}
            className="h-11 text-xs text-beni"
          >
            このコミュニティから退出する
          </button>
        )}
      </section>

      {message ? <p className="text-xs text-stone-500">{message}</p> : null}
    </div>
  );
}
