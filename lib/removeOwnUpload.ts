// 自分が上げたばかりの写真を、保管庫から消す処理です。画面（"use client" のファイル）から使います。
//
// 写真を上げてから DB に書き込む、という順番なので、
// DB への書き込みが失敗すると、写真だけが保管庫に残ってしまいます（どこからも使われないファイル）。
// 失敗したときにこれを呼んで、上げた写真を消します。消せなくても、元の失敗の知らせはそのまま出します
import { createClient } from "@/lib/supabase/client";

export async function removeOwnUpload(bucket: "posts" | "drawings" | "cards", path: string) {
  await createClient()
    .storage.from(bucket)
    .remove([path])
    .catch(() => {
      // 消せなくても困ることはありません（アプリからは見えないファイルが1つ残るだけです）
    });
}
