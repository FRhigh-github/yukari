// 思いがけないエラーを、DB（error_reports）に残す処理です。サーバー側からだけ使います。
//
// ▼ なぜ要るのか
//   console.error だけだと、Vercel の記録にしか残らず、無料プランではすぐ消えます。
//   誰かの画面でエラーが起きても、運営者が気づけません。
//   DB に残しておき、1日1回の処理（app/api/cron/daily）が、新しいものをメールで知らせます。
//
// 記録に失敗しても、元の処理は止めません（エラーの記録のせいで、アプリが動かなくならないように）。
// server-only = "use client" の側から読み込むと、ビルドの時点でエラーにする印です
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type ErrorReport = {
  source: "server" | "client" | "cron" | "usage";
  message: string;
  path?: string | null;
  detail?: Record<string, unknown> | null;
};

export async function reportError({ source, message, path, detail }: ErrorReport) {
  try {
    await createAdminClient()
      .from("error_reports")
      .insert({
        source,
        // 長すぎると DB が受け付けないので、決まった長さで切ります
        message: message.slice(0, 2000),
        path: path?.slice(0, 500) ?? null,
        detail: detail ?? null,
      });
  } catch (error) {
    console.error("エラーを記録できませんでした", error);
  }
}
