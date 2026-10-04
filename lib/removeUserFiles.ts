// ある人が保管庫に置いたファイルを、全部消す処理です。サーバー側からだけ使います。
// 退会（app/api/account/delete）で使います。
//
// ▼ なぜ要るのか
//   アカウントを消すと、DB の投稿・お祝い・カード・手紙は連鎖（cascade）で一緒に消えます。
//   でも保管庫（Storage）の写真のファイルは、DB とは別の場所にあるので残ってしまいます。
//   残すと、退会した人の写真がずっと置かれたままになるので、ここで消します。
//
// ▼ service_role の鍵を使います
//   退会する本人の分だけを消すので、フォルダの名前（本人の id）を、呼ぶ側で必ず本人のものにします
// server-only = "use client" の側から読み込むと、ビルドの時点でエラーにする印です
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// 本人のフォルダがある置き場所（<本人の id>/<ファイル名>）
const BUCKETS = ["posts", "drawings", "cards", "avatars"];

export async function removeUserFiles(userId: string) {
  const storage = createAdminClient().storage;

  for (const bucket of BUCKETS) {
    // list は一度に返す数に上限があるので、無くなるまで繰り返し取って消します
    // （消すたびに一覧が短くなるので、毎回先頭から取り直せば全部たどれます）
    for (let round = 0; round < 100; round += 1) {
      const { data: files, error } = await storage
        .from(bucket)
        .list(userId, { limit: 1000 });
      if (error) throw new Error(`${bucket} の一覧: ${error.message}`);
      if (!files || files.length === 0) break;

      const { error: removeError } = await storage
        .from(bucket)
        .remove(files.map((file) => `${userId}/${file.name}`));
      if (removeError) throw new Error(`${bucket} の削除: ${removeError.message}`);
    }
  }

  // 前の形のプロフィールのアイコン（avatars/<本人の id>.jpg）。無ければ何も起きません
  await storage.from("avatars").remove([`${userId}.jpg`]);
}
