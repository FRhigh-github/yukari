// 思い出ログインの画面です。
//
//   ① 同じコミュニティの3人から、それぞれコードをもらう
//   ② ここに3つ入れる → 申請が立つ
//   ③ 24時間、コミュニティの全員が見られる状態になる（誰でも止められます）
//   ④ 誰も止めなければ、ここに戻ってきてログインできる
//
// 申請の番号はブラウザに覚えさせます。
// まだログインできていないので、DBに「あなたの申請はこれです」と
// 聞ける状態にないためです。
//
// 番号と一緒に「引換券」も覚えさせます。
// 番号は同じコミュニティの人なら誰でも見られるので、
// 引換券が無いとログインできないようにしてあります（lib/recoveryTicket.ts）。

"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import KnotMark from "@/components/KnotMark";

// ブラウザに覚えさせるときの名前
const SAVED_KEY = "yukari-recovery-request";

export default function RecoverPage() {
  const router = useRouter();

  const [codes, setCodes] = useState(["", "", ""]);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 申請が立ったあとの案内に使います
  const [waiting, setWaiting] = useState(false);

  // 3つのうち1つだけを書き換えます。
  // .map で「その番号だけ新しい値、ほかはそのまま」という並びを作ります。
  const setCode = (index: number, value: string) =>
    setCodes(codes.map((code, i) => (i === index ? value : code)));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsSending(true);

    // 通信が切れていると、fetch そのものが失敗します（例外）。
    // 受け止めないと、ボタンが押せないまま戻らなくなるので、ここで知らせて戻します
    let response: Response;
    let result;
    try {
      response = await fetch("/api/recovery", {
        method: "POST",
        body: JSON.stringify({ codes }),
      });
      result = await response.json();
    } catch {
      setMessage("つながりませんでした。電波の良いところで、もう一度お試しください");
      setIsSending(false);
      return;
    }

    if (!response.ok) {
      setMessage(result.error);
      setIsSending(false);
      return;
    }

    try {
      // 番号と引換券を1つにまとめて、文字にして覚えさせます
      localStorage.setItem(
        SAVED_KEY,
        JSON.stringify({ requestId: result.requestId, ticket: result.ticket }),
      );
    } catch {
      // 使えない環境でも、この画面を開いたままなら続けられます
    }

    setWaiting(true);
    setIsSending(false);
  };

  // 24時間たったあと、ここを押してログインします
  const handleComplete = async () => {
    setMessage(null);
    setIsSending(true);

    // 覚えさせた番号と引換券を取り出します。
    // 壊れていたり、前の形（番号だけ）で残っていたりしたら、空のまま送ります
    // （サーバーが「この端末からは復旧できません」と返します）
    let saved: { requestId?: string; ticket?: string } = {};
    try {
      saved = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "{}");
    } catch {
      saved = {};
    }

    // 上の handleSubmit と同じく、通信の失敗を受け止めます
    let response: Response;
    let result;
    try {
      response = await fetch("/api/recovery/complete", {
        method: "POST",
        body: JSON.stringify({ requestId: saved.requestId, ticket: saved.ticket }),
      });
      result = await response.json();
    } catch {
      setMessage("つながりませんでした。電波の良いところで、もう一度お試しください");
      setIsSending(false);
      return;
    }

    if (!response.ok) {
      setMessage(result.error);
      setIsSending(false);
      return;
    }

    if (result.waiting) {
      setMessage(
        `まだ待ち時間の最中です（${new Date(result.readyAt).toLocaleString("ja-JP")} 以降）`,
      );
      setIsSending(false);
      return;
    }

    // 受け取った合言葉を、実際のログイン状態に変えます
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: result.tokenHash,
    });

    if (error) {
      console.error("思い出ログインに失敗しました", error);
      setMessage("ログインできませんでした。もう一度お試しください");
      setIsSending(false);
      return;
    }

    localStorage.removeItem(SAVED_KEY);
    router.push("/");
    router.refresh();
  };

  return (
    <main className="flex h-full flex-col justify-center gap-5 p-8">
      <KnotMark />

      <div>
        <h1 className="text-xl font-bold text-stone-800">思い出ログイン</h1>
        <p className="mt-2 text-xs leading-relaxed text-stone-500">
          同じコミュニティの3人に、それぞれコードを発行してもらってください。
          3つそろうと、24時間後にログインできます。
        </p>
      </div>

      {waiting ? (
        <div className="space-y-4">
          <p className="rounded-xl bg-stone-100 p-4 text-xs leading-relaxed text-stone-600">
            受け付けました。コミュニティのみなさんに知らせています。
            <br />
            24時間たったら、この画面に戻ってきてください。
          </p>

          <button
            type="button"
            onClick={handleComplete}
            disabled={isSending}
            className="w-full cursor-pointer rounded-full bg-beni py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {isSending ? "確認中..." : "ログインする"}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {codes.map((code, index) => (
            <input
              key={index}
              required
              maxLength={6}
              value={code}
              onChange={(event) => setCode(index, event.target.value)}
              placeholder={`${index + 1}人目のコード`}
              // uppercase = 入力した文字を大文字で表示します
              className="w-full rounded-xl border border-stone-200 px-4 py-3 text-center text-lg uppercase tracking-widest text-stone-800 focus:outline-none"
            />
          ))}

          <button
            type="submit"
            disabled={isSending}
            className="w-full cursor-pointer rounded-full bg-beni py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {isSending ? "確認中..." : "3つのコードで申請する"}
          </button>
        </form>
      )}

      {message ? <p className="text-xs text-red-600">{message}</p> : null}

      {/* 前に申請した人が、24時間後に戻ってくるための入口 */}
      {!waiting ? (
        <button
          type="button"
          onClick={handleComplete}
          className="cursor-pointer text-center text-xs text-stone-500 underline"
        >
          すでに申請した方はこちら
        </button>
      ) : null}

      <Link href="/login" className="text-center text-xs text-stone-500">
        ログイン画面へ戻る
      </Link>
    </main>
  );
}
