// 保管庫（Storage）のファイルを、場所を指定して消す処理です。サーバー側からだけ使います。
//
// DB の行を消しても、保管庫のファイルは別の場所にあるので残ります（Supabase の決まり）。
// 残すと、消したはずの写真が置かれたままになるので、行を消したあとにここで消します。
//
// ▼ service_role の鍵で消します
//   作成者が他人のご報告を消したときなど、ファイルの持ち主でない人が消すこともあるためです。
//   渡してよいのは、RLS を通して読めた行に入っていた場所だけです（lib/signedUrls.ts と同じ約束）。
//   念のため、アプリが作る形（<id>/<ランダムな id>.jpg か .png）でない場所は消しません
// server-only = "use client" の側から読み込むと、ビルドの時点でエラーにする印です
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const APP_FILE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png)$/;

export async function removeStorageFiles(bucket: string, paths: (string | null)[]) {
  const targets = paths.filter((path): path is string => path !== null && APP_FILE.test(path));
  if (targets.length === 0) return;
  const { error } = await createAdminClient().storage.from(bucket).remove(targets);
  // 消せなくても、DB の行はもう消えているので、ここでは止めずに記録だけ残します
  if (error) console.error(`${bucket} のファイルを消せませんでした`, error);
}
