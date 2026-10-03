// 「通知を受け取る」を押した端末の宛先を保存します。POST /api/push/subscribe
//   { endpoint, keys: { p256dh, auth } }
//
// 1台のスマホを何人かで使うこともあるので、同じ宛先がすでに別の人のものなら、
// いまログインしている人のものに付け替えます（前の人の通知が、次の人に届かないように）。
// 付け替えは本人の行ではないので、本人確認をしてから、サーバーの鍵で書きます。

import { NextResponse } from "next/server";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const userId = await getCurrentUserId(await createClient());
  if (userId === null) {
    return NextResponse.json({ error: "ログインしていません" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  // 宛先は、ブラウザの会社の通知サーバーの https の URL です。それ以外は受け付けません
  if (
    typeof endpoint !== "string" ||
    !endpoint.startsWith("https://") ||
    endpoint.length > 1000 ||
    typeof p256dh !== "string" ||
    typeof auth !== "string"
  ) {
    return NextResponse.json({ error: "宛先が正しくありません" }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert({ endpoint, user_id: userId, p256dh, auth }, { onConflict: "endpoint" });
  if (error) {
    console.error("通知の宛先を保存できませんでした", error);
    return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
