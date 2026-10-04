// 送ったカード・書いた手紙を消す処理です。POST /api/items/delete  { kind, id }
//   kind = "card"（送ったカード）/ "letter"（書いた手紙）
//
// 消してよいかは DB の許可（RLS）が決めます。カードは送った人、手紙は書いた人だけが消せます。
// 行が消えたら、保管庫の絵のファイルも消します（lib/removeStorageFiles.ts）。
// ご報告は、付いているお祝いのファイルもあるので、別の処理です（app/api/posts/delete）。

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { removeStorageFiles } from "@/lib/removeStorageFiles";
import { isUuid } from "@/lib/isUuid";

// 種類ごとの、表の名前・絵の場所の列・置き場所
const KINDS = {
  card: { table: "card_sends", column: "drawing_url", bucket: "cards" },
  letter: { table: "time_capsules", column: "image_url", bucket: "drawings" },
} as const;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const kind = body?.kind;
  const id = body?.id;
  if ((kind !== "card" && kind !== "letter") || !isUuid(id)) {
    return NextResponse.json({ error: "見つかりません" }, { status: 400 });
  }
  const { table, column, bucket } = KINDS[kind as keyof typeof KINDS];

  // ログインしている本人として消します（RLS が効きます）。
  // .select() を付けると、実際に消えた行が返ってきます。許可が無くて消えなかったときは0件です
  const supabase = await createClient();
  const { data: deleted, error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .select(column);

  if (error || deleted?.length !== 1) {
    return NextResponse.json({ error: "消せませんでした" }, { status: 403 });
  }

  const row = deleted[0] as Record<string, string | null>;
  await removeStorageFiles(bucket, [row[column]]);
  return NextResponse.json({ ok: true });
}
