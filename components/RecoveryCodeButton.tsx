// 「復旧を手伝う」ボタンです。
//
// アカウントに入れなくなった人のために、コードを1つ発行します。
// 同じコミュニティの3人が、それぞれ別のコードを発行し、
// 本人がその3つをそろえて入れると、復旧の申請が立ちます。
//
// 1人で3つ作れないよう、DB側で「1人につき1つまで」に縛ってあります。
// もう一度押すと、前のコードは無効になり、新しいものに入れ替わります。

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 口頭で伝える前提なので、紛らわしい文字は外します。
// 0とO、1とI、そして小文字は使いません。
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const makeCode = () =>
  Array.from(
    { length: 6 },
    () => LETTERS[Math.floor(Math.random() * LETTERS.length)],
  ).join("");

type RecoveryCodeButtonProps = {
  targetUserId: string;
  targetName: string;
};

export default function RecoveryCodeButton({
  targetUserId,
  targetName,
}: RecoveryCodeButtonProps) {
  // 発行したコード。まだ押していなければ null
  const [code, setCode] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleIssue = async () => {
    setMessage(null);
    setIsSending(true);

    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      // 前に発行したぶんを消してから入れ直します。
      // 1人1つの縛りがあるので、消さずに入れるとぶつかります。
      await supabase
        .from("recovery_codes")
        .delete()
        .eq("target_user", targetUserId)
        .eq("issued_by", data.user.id);

      const newCode = makeCode();

      const { error } = await supabase.from("recovery_codes").insert({
        code: newCode,
        target_user: targetUserId,
        issued_by: data.user.id,
      });

      if (error) throw new Error(error.message);

      setCode(newCode);
    } catch (issueError) {
      setMessage(
        issueError instanceof Error
          ? issueError.message
          : "コードを発行できませんでした",
      );
    }

    setIsSending(false);
  };

  // ▼ 発行後
  if (code !== null) {
    return (
      <div className="rounded-2xl border border-stone-200 p-4 text-center">
        <p className="text-xs text-stone-500">{targetName} さんに伝えてください</p>

        {/* tracking-widest = 文字の間隔を広げる。読み上げやすくなります */}
        <p className="my-2 text-3xl font-bold tracking-widest text-stone-800">
          {code}
        </p>

        <p className="text-[10px] leading-relaxed text-stone-400">
          24時間で使えなくなります。
          <br />
          このコードだけでは入れません。ほかに2人ぶん必要です。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleIssue}
        disabled={isSending}
        className="w-full cursor-pointer rounded-full border border-stone-300 py-3 text-xs font-bold text-stone-600 disabled:opacity-40"
      >
        {isSending ? "発行中..." : "復旧を手伝う（コードを発行）"}
      </button>

      <p className="text-center text-[10px] text-stone-400">
        {targetName} さんがアプリに入れなくなったときに使います
      </p>

      {message ? (
        <p className="text-center text-xs text-red-600">{message}</p>
      ) : null}
    </div>
  );
}
