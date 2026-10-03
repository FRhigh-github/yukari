// 画面（ブラウザ）で思いがけないエラーが起きたときに、記録してもらう処理です。POST /api/client-error
// app/error.tsx（エラーの画面）が呼びます。ログインしている人だけが呼べます（proxy.ts）。
//
// 中身はブラウザから届くもの（誰でも書き換えられる）なので、長さを切ってから残すだけにします。

import { NextResponse } from "next/server";
import { reportError } from "@/lib/reportError";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message : "（中身の無いエラー）";
  const path = typeof body?.path === "string" ? body.path.split("?")[0] : null;
  const digest = typeof body?.digest === "string" ? body.digest.slice(0, 100) : null;

  await reportError({ source: "client", message, path, detail: { digest } });
  return NextResponse.json({ ok: true });
}
