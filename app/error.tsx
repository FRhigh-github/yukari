// 画面を作っている途中で、思いがけないエラーが起きたときに出す画面です。
//
// ▼ なぜ要るのか
//   これが無いと、Next.js が用意した英語のエラー画面（ほぼ真っ白）が出て、
//   そこから先へ進めなくなります。発表中に電波が弱くなったときなどに起きえます。
//   ここでは「もう一度読み込む」と「ホームへ」を出して、自分で立て直せるようにします。
//
// ▼ "use client" が要る理由
//   エラーを受け止める仕組み（React の Error Boundary）は、ブラウザ側でしか動かないためです。
//
// ▼ retry について
//   この版の Next.js では、もう一度作り直す関数の名前が retry です（前の版は reset）。
//   押すと、エラーになった部分だけを、もう一度サーバーに取りに行きます。

"use client";

import { useEffect } from "react";
import KnotMark from "@/components/KnotMark";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  // 原因は開発者向けに、ブラウザのコンソールへ残しておきます
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex h-full flex-col items-center justify-center gap-5 bg-[#faf9f6] p-8 text-center">
      <KnotMark />
      <div className="space-y-1">
        <h1 className="text-lg font-bold text-stone-800">うまく表示できませんでした</h1>
        <p className="text-sm leading-relaxed text-stone-500">
          電波が弱いと起きることがあります。
          <br />
          少し待ってから、もう一度お試しください。
        </p>
      </div>

      <button
        type="button"
        onClick={() => retry()}
        className="h-12 w-full max-w-xs cursor-pointer rounded-full bg-beni text-base font-bold text-white"
      >
        もう一度読み込む
      </button>
      {/* Link ではなく、ブラウザごと読み込み直してホームへ行きます。
          ホーム（/）でエラーになったとき、Link で同じ / へ移っても、
          このエラー画面が消えないためです */}
      <button
        type="button"
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- わざと読み込み直すため
        onClick={() => window.location.assign("/")}
        className="flex h-11 cursor-pointer items-center text-sm text-stone-500 underline"
      >
        ホームへ戻る
      </button>
    </main>
  );
}
