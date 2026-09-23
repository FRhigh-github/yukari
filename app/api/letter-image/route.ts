// 未来への手紙の「紙の画像」のURLを返す処理です。/api/letter-image?id=手紙のid
//
// ▼ なぜサーバーで作るのか
//   手紙の画像は、書いた人の id のフォルダ（drawings/<書いた人の id>/<手紙の id>.png）にあります。
//   置き場所の決まり（supabase/04_security.sql）で、他人のフォルダはブラウザから直接読めません。
//   そこで、サーバーが「この人はこの手紙を読んでいいか」を確かめてから、URLを作って返します。
//
// ▼ 確かめ方
//   ログインしている人の鍵で time_capsules を読みます。
//   RLS が「開封日を過ぎていて、宛先が自分か全員」の手紙しか返さないので、
//   読めた＝見てよい手紙、ということになります。
//   読めた手紙の image_url だけを URL にするので、ほかの画像のURLは作れません。

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrls } from "@/lib/signedUrls";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "手紙が見つかりません" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: capsule } = await supabase
    .from("time_capsules")
    .select("image_url")
    .eq("id", id)
    .maybeSingle();

  const path = capsule?.image_url ?? null;
  if (path === null) {
    return NextResponse.json({ error: "手紙が見つかりません" }, { status: 404 });
  }

  // 前のデータで、最初から URL が入っているものはそのまま返します
  if (path.startsWith("http")) return NextResponse.json({ url: path });

  const findUrl = await getSignedUrls("drawings", [path]);
  return NextResponse.json({ url: findUrl(path) });
}
