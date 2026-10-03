// サーバーで思いがけないエラーが起きたときに、Next.js が呼ぶ処理です（instrumentation.ts という決まった名前）。
// エラーを DB に残し、運営者が気づけるようにします（lib/reportError.ts）。

import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  // 入口の確かめ（proxy.ts）は、Node.js ではない軽い環境で動くので、そこでは記録しません。
  // 記録に使う DB の窓口が、Node.js の上でしか動かないためです
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { reportError } = await import("@/lib/reportError");
  const message = err instanceof Error ? err.message : String(err);
  // digest = React がエラーに付ける番号。画面に出した「エラーの番号」と照らし合わせられます
  const digest =
    typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : null;

  await reportError({
    source: "server",
    message,
    // ? 以降には id などが入るので、場所（パス）だけを残します
    path: request.path.split("?")[0],
    detail: { digest, method: request.method, routeType: context.routeType, routePath: context.routePath },
  });
};
