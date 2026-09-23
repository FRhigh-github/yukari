"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// 招待コードを作ります。
// crypto.randomUUID() は「-」入りの長い文字列なので、
// 「-」を消して先頭6文字だけ取り、大文字にしています。
const makeInviteCode = () =>
  crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();

type CommunityCreateFormProps = {
  // true = ホームの切り替えの中で使う。作ったら、そのコミュニティのホームを出します。
  // false = 作る画面(/communities/new)で使う。作ったら、設定の画面(招待コードがある)へ移ります
  inline?: boolean;
};

export default function CommunityCreateForm({ inline = false }: CommunityCreateFormProps) {
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

    // ▼ 作るのと、自分を owner として入れるのを、DB の関数1つでまとめてやります
    //   （supabase/04_security.sql の create_community）。
    //   前は画面から memberships に直接書き込んでいましたが、
    //   それを許すと「招待コードなしで、どのコミュニティにも入れる」状態になるため、
    //   直接の書き込みは止めて、この関数と join_community（招待コード）だけにしました。
    const { data: id, error: createError } = await supabase.rpc(
      "create_community",
      { community_name: name, code: makeInviteCode() },
    );

    if (createError || typeof id !== "string") {
      setError("作成に失敗しました: " + (createError?.message ?? "原因不明"));
      return;
    }

    router.push(inline ? `/?c=${id}` : `/communities/${id}`);
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
        className="h-12 w-full rounded-xl border border-kin/40 bg-white px-4 text-base focus:border-kin focus:outline-none"
      />

      <button
        type="submit"
        className="h-12 w-full rounded-xl bg-beni text-sm font-bold text-white"
      >
        作る
      </button>

      {error ? <p className="text-xs text-beni">{error}</p> : null}
    </form>
  );
}
