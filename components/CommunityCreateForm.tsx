"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// 招待コードを作ります。
// crypto.randomUUID() は「-」入りの長い文字列なので、
// 「-」を消して先頭6文字だけ取り、大文字にしています。
const makeInviteCode = () =>
  crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();

export default function CommunityCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.push("/login");
      return;
    }

    // id はこちらで先に決めます。
    // 作ったあとに「作ったものを読み返す」ことができないためです
    // （まだメンバーではないので、RLS に止められます）。
    const id = crypto.randomUUID();

    const created = await supabase.from("communities").insert({
      id,
      name,
      invite_code: makeInviteCode(),
      created_by: data.user.id,
    });

    if (created.error) {
      setError("作成に失敗しました: " + created.error.message);
      return;
    }

    // 作っただけではメンバーになりません。自分を owner として登録します。
    const joined = await supabase.from("memberships").insert({
      user_id: data.user.id,
      community_id: id,
      role: "owner",
    });

    if (joined.error) {
      setError("参加の登録に失敗しました: " + joined.error.message);
      return;
    }

    router.push(`/communities/${id}`);
    router.refresh();
  };

  return (
    <form onSubmit={handleCreate} className="space-y-2">
      <input
        required
        maxLength={40}
        placeholder="コミュニティ名"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm focus:outline-none"
      />

      <button
        type="submit"
        className="w-full rounded-xl bg-stone-800 py-3 text-sm font-bold text-white"
      >
        作る
      </button>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </form>
  );
}
