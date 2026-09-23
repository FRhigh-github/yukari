// 非公開の置き場所（posts / drawings / cards）にある写真の「期限付きURL」を作る処理です。
// サーバー側からだけ使います。"use client" のファイルから読み込まないこと。
//
// ▼ なぜ、ここにまとめたのか
//   前は画面を開くたびに createSignedUrls で新しいURLを作っていました。
//   期限付きURLは、作るたびに中の文字が変わります。
//   ブラウザは「URLが同じなら、前にダウンロードした写真を使い回す」ので、
//   URLが毎回変わると、同じ写真でも毎回ダウンロードし直すことになっていました。
//
//   ここでは、1枚ごとに作ったURLを Next.js のキャッシュ（unstable_cache）に6日間覚えておき、
//   その間は同じURLを返します。URLそのものの期限は7日なので、覚えている間に切れることはありません。
//   → 2回目以降は、写真がブラウザからすぐ出ます。
//
// ▼ 安全のための約束
//   URL は service_role の鍵（RLS を通らない鍵）で作ります。
//   キャッシュの中ではログイン情報（Cookie）を使えないためです。
//   その代わり、ここに渡してよいのは「RLS を通した問い合わせで取ってきた場所」だけにします。
//   （posts・post_reactions・card_sends から取った image_url / drawing_url など）
//   画面から送られてきた文字をそのまま渡すと、見てはいけない写真のURLまで作れてしまいます。

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// URLそのものの期限（秒）。7日
const EXPIRES_IN = 60 * 60 * 24 * 7;
// 同じURLを使い回す長さ（秒）。6日。期限より1日短くして、切れたURLを返さないようにします
const REUSE_FOR = 60 * 60 * 24 * 6;

// 1枚ぶんのURLを作ります。bucket と path が同じなら、6日間は同じ答えを返します
const signOne = unstable_cache(
  async (bucket: string, path: string) => {
    const { data, error } = await createAdminClient()
      .storage.from(bucket)
      .createSignedUrl(path, EXPIRES_IN);
    // 失敗したときは throw します。
    // null を返すと「URLが無い」という答えまで6日間覚えてしまうためです
    if (error || !data) throw new Error(error?.message ?? "URLを作れませんでした");
    return data.signedUrl;
  },
  ["signed-url"],
  { revalidate: REUSE_FOR },
);

// 場所の一覧を受け取り、「場所 → URL」を引ける関数を返します。
// 使い方: const findUrl = await getSignedUrls("posts", paths);  findUrl(post.image_url)
export async function getSignedUrls(bucket: string, paths: string[]) {
  // 同じ場所が何度も入っていても、作るのは1回ずつにします
  const unique = Array.from(new Set(paths));

  // 1枚ずつ同時に作ります。覚えているものは通信なしですぐ返ってきます
  const urls = await Promise.all(
    unique.map((path) => signOne(bucket, path).catch(() => null)),
  );

  return (path: string | null) => {
    if (!path) return null;
    const index = unique.indexOf(path);
    return index === -1 ? null : urls[index];
  };
}
