"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CommunityJoinFormProps = {
  // アカウントを作った直後に来たかどうか。行き先を変えるのに使います。
  isFirstTime?: boolean;
};

export default function CommunityJoinForm({
  isFirstTime = false,
}: CommunityJoinFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    const supabase = createClient();

    // join_community は schema.sql で用意してある DB 側の関数です。
    // 招待コードから該当のコミュニティを探して、自分を登録してくれます。
    const { error } = await supabase.rpc("join_community", {
      code: code.trim().toUpperCase(),
    });

    if (error) {
      setMessage("コードが違うようです");
      return;
    }

    // 参加できたら、そのままホームへ戻します。
    // 「参加しました」とだけ出して同じ画面に残ると、
    // 次に何をすればいいのか分からなくなるためです。
    // 初めての人（/start から来た人）には、ホームで一言だけ案内を出します
    router.push(isFirstTime ? "/?tour=1" : "/");
    router.refresh();
  };

  return (
    <form onSubmit={handleJoin} className="space-y-2">
      <input
        required
        placeholder="招待コード"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        // uppercase = 入力した文字を大文字で表示します
        className="w-full rounded-xl border border-stone-200 px-4 py-3 text-center text-sm uppercase tracking-widest focus:outline-none"
      />

      <button
        type="submit"
        className="w-full rounded-xl border border-stone-300 py-3 text-sm font-bold text-stone-700"
      >
        参加する
      </button>

      {message ? <p className="text-xs text-stone-500">{message}</p> : null}
    </form>
  );
}
