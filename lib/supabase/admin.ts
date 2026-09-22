// サーバーの中だけで使う、特別な権限のつなぎ役です。
//
// ふだん使っている鍵（ANON_KEY）は「ログインしている人」として振る舞うので、
// RLS に従います。つまり、自分に見せていいものしか見えません。
//
// ところが思い出ログインでは、本人はまだログインできていません。
// 誰でもない状態なので、コードが正しいかどうかを照合することすらできません。
// そこで、RLS を通らないこの鍵を使います。
//
// ▼ 絶対に守ること
//   このファイルを "use client" のファイルから読み込まないこと。
//   読み込むと鍵がブラウザに配られ、誰でもDBを全部読み書きできる状態になります。
//   （NEXT_PUBLIC_ を付けていないので、本来ブラウザ側では空になります）

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY が設定されていません");
  }

  return createClient(url, key, {
    auth: {
      // サーバー側では、ログイン状態を持ち回る必要がありません
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
