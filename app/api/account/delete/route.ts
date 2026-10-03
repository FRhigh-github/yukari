// 退会（アカウントを消す）処理です。POST /api/account/delete
//
// 1. ログインしている本人かを確かめる（本人以外のアカウントは消せません）
// 2. 保管庫の写真のファイルを全部消す（lib/removeUserFiles.ts）
// 3. アカウントを消す。投稿・お祝い・カード・手紙・参加などは、DB の連鎖（cascade）で一緒に消えます
//
// アカウントを消すのは、ふつうの鍵ではできません（Supabase の決まり）。
// なので、本人確認をしてから、サーバーの service_role の鍵で消します。

import { NextResponse } from "next/server";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeUserFiles } from "@/lib/removeUserFiles";
import { removeStorageFiles } from "@/lib/removeStorageFiles";

export async function POST(request: Request) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (userId === null) {
    return NextResponse.json({ error: "ログインしていません" }, { status: 401 });
  }

  // 押し間違いや、よそのページからの呼び出しで消えないよう、
  // 画面で「消す」を選んだときに付ける合図がなければ断ります
  const body = await request.json().catch(() => null);
  if (body?.confirm !== "delete") {
    return NextResponse.json({ error: "確認が取れませんでした" }, { status: 400 });
  }

  // ▼ ほかの人のフォルダにある、自分あてのファイルの場所を控えておきます。
  //   自分のご報告に付いた手書きのお祝いと、自分あてに届いたカードです。
  //   アカウントを消すと行は連鎖で消えますが、ファイルは描いた人・送った人のフォルダに残るためです
  const [{ data: reactionsOnMine }, { data: cardsToMe }] = await Promise.all([
    supabase
      .from("post_reactions")
      .select("drawing_url, posts!inner(author_id)")
      .eq("posts.author_id", userId),
    supabase.from("card_sends").select("drawing_url").eq("to_user", userId),
  ]);

  try {
    await removeUserFiles(userId);
  } catch (error) {
    console.error("退会：写真のファイルを消せませんでした", error);
    return NextResponse.json(
      { error: "消せませんでした。時間をおいて、もう一度お試しください" },
      { status: 500 },
    );
  }

  const { error } = await createAdminClient().auth.admin.deleteUser(userId);
  if (error) {
    console.error("退会：アカウントを消せませんでした", error);
    return NextResponse.json(
      { error: "消せませんでした。時間をおいて、もう一度お試しください" },
      { status: 500 },
    );
  }

  await Promise.all([
    removeStorageFiles("drawings", reactionsOnMine?.map((reaction) => reaction.drawing_url) ?? []),
    removeStorageFiles("cards", cardsToMe?.map((card) => card.drawing_url) ?? []),
  ]);

  // ログインの証明書（Cookie）も消しておきます
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
