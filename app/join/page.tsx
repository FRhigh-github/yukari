"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function JoinPage() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const handleJoin = async () => {
    const supabase = createClient();

    const { data, error } = await supabase.rpc("join_community", {
      code: code,
    });

    if (error) {
      console.error(error);
      setMessage("コードが違うようです");
      return;
    }

    setMessage("参加しました");
  };

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-bold text-stone-800">
        コミュニティに参加
      </h1>

      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="招待コード"
        className="mb-3 block w-full rounded-lg border border-amber-200 px-3 py-2"
      />

      <button
        onClick={handleJoin}
        className="rounded-lg bg-orange-500 px-4 py-2 text-white"
      >
        <p className="mt-3 text-sm text-stone-600">{message}</p>
        参加する
      </button>
    </main>
  );
}
