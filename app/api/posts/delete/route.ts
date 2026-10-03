// ご報告を消す処理です。POST /api/posts/delete  { postId }
//
// 1. 消してよいかは DB の許可（RLS）が決めます。書いた本人と、そのコミュニティの作成者だけが消せます
// 2. 消えたら、写真のファイルと、付いていた手書きのお祝いのファイルも保管庫から消します
//    （前は DB の行だけが消えて、写真は保管庫に残り続けていました）

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { removeStorageFiles } from "@/lib/removeStorageFiles";
import { isUuid } from "@/lib/isUuid";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const postId = body?.postId;
  if (!isUuid(postId)) {
    return NextResponse.json({ error: "ご報告が見つかりません" }, { status: 400 });
  }

  // ログインしている本人として DB に聞きます（RLS が効きます）
  const supabase = await createClient();

  // 消す前に、ファイルの場所を控えておきます（行が消えると、場所が分からなくなるため）
  const { data: reactions } = await supabase
    .from("post_reactions")
    .select("drawing_url")
    .eq("post_id", postId);

  // .select() を付けると、実際に消えた行が返ってきます。
  // 許可が無くて消えなかったときも「エラー」にはならないので、件数で確かめます
  const { data: deleted, error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .select("image_url");

  if (error || deleted?.length !== 1) {
    return NextResponse.json({ error: "消せませんでした" }, { status: 403 });
  }

  await Promise.all([
    removeStorageFiles("posts", [deleted[0].image_url]),
    removeStorageFiles("drawings", reactions?.map((reaction) => reaction.drawing_url) ?? []),
  ]);

  return NextResponse.json({ ok: true });
}
