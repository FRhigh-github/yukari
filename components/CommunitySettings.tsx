"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CommunitySettingsProps = {
  communityId: string;
  currentName: string;
  // 作成者かどうか。退出の確認に「あなたは作成者です」と添えるために使います
  isOwner: boolean;
  // デモのゲストかどうか。ゲストには名前の変更と退出を出しません
  isGuest: boolean;
};

export default function CommunitySettings({
  communityId,
  currentName,
  isOwner,
  isGuest,
}: CommunitySettingsProps) {
  const router = useRouter();

  const [name, setName] = useState(currentName);
  const [message, setMessage] = useState<string | null>(null);

  // 退出を2段階にするための状態。
  // いきなり消えると事故になるので、1回目は確認に変わるだけにします。
  const [isConfirming, setIsConfirming] = useState(false);

  // 送っている間は true。ボタンを押せなくして、二度押しで2回送るのを防ぎます
  const [isSaving, setIsSaving] = useState(false);

  const handleRename = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsSaving(true);

    const supabase = createClient();

    // ▼ 名前は、メンバーなら誰でも変えられます。
    //   表を直接書き換える許可は誰にも出していないので、
    //   名前だけを変える DB の関数（supabase/01_schema.sql の rename_community）を呼びます
    // 変えられたら true、メンバーでない・名前が長すぎるなどで変えなかったら false が返ります
    const { data: changed, error } = await supabase.rpc("rename_community", {
      target_community: communityId,
      new_name: name,
    });
    setIsSaving(false);

    if (error || changed !== true) {
      setMessage("変更できませんでした");
      return;
    }

    setMessage("変更しました");
    router.refresh();
  };

  const handleLeave = async () => {
    setMessage(null);
    setIsSaving(true);

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
      setMessage("退出できませんでした。もう一度お試しください");
      setIsConfirming(false);
      setIsSaving(false);
      return;
    }

    // 退出したので、もうこのコミュニティのホームには戻れません。
    // ホームへ送ると、残っているコミュニティが選び直されます。
    router.push("/");
    router.refresh();
  };

  // ▼ デモのゲストには、名前の変更も退出も出しません。
  //   デモ用コミュニティは審査員みんなで見ているので、1人が変えると全員の画面が変わります。
  //   退出すると、ゲストはほかのコミュニティに入れないので、どこにも戻れなくなります。
  //   （DB 側でも止めています。supabase/01_schema.sql の is_demo_guest）
  if (isGuest) {
    return (
      <p className="text-xs leading-relaxed text-stone-500">
        デモ用のコミュニティなので、名前の変更と退出はできません。
      </p>
    );
  }

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
            disabled={isSaving}
            className="h-11 shrink-0 rounded-xl border border-kin bg-white px-4 text-sm font-bold text-kin disabled:opacity-50"
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
                disabled={isSaving}
                className="h-11 flex-1 rounded-xl bg-beni text-sm font-bold text-white disabled:opacity-50"
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
