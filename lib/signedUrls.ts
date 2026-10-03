// 非公開の置き場所（posts / drawings / cards）にある写真の「期限付きURL」を作る処理です。
// サーバー側からだけ使います。"use client" のファイルから読み込まないこと。
//
// ▼ なぜ、ここにまとめたのか
//   前は画面を開くたびに createSignedUrls で新しいURLを作っていました。
//   期限付きURLは、作るたびに中の文字が変わります。
//   ブラウザは「URLが同じなら、前にダウンロードした写真を使い回す」ので、
//   URLが毎回変わると、同じ写真でも毎回ダウンロードし直すことになっていました。
//
//   ここでは、1枚ごとに作ったURLを Next.js のキャッシュ（unstable_cache）に20時間覚えておき、
//   その間は同じURLを返します。URLそのものの期限は1日なので、覚えている間に切れることはありません。
//
// ▼ 期限を1日にしている理由
//   期限付きURLは「ログインなしで使える合鍵」です。URL が外に漏れると、期限まで誰でも見られます。
//   ご報告を消した人や、コミュニティを抜けた人にも、期限までは見えてしまいます。
//   前は7日でしたが、漏れたときに見られてしまう長さを短くするため、1日にしました。
//   （その分、ブラウザが写真をダウンロードし直すのは1日に1回になります）
//   → 2回目以降は、写真がブラウザからすぐ出ます。
//
// ▼ 安全のための約束
//   URL は service_role の鍵（RLS を通らない鍵）で作ります。
//   キャッシュの中ではログイン情報（Cookie）を使えないためです。
//   その代わり、ここに渡してよいのは「RLS を通した問い合わせで取ってきた場所」だけにします。
//   （posts・post_reactions・card_sends から取った image_url / drawing_url など）
//   画面から送られてきた文字をそのまま渡すと、見てはいけない写真のURLまで作れてしまいます。

// server-only = "use client" の側から読み込むと、ビルドの時点でエラーにする印です（service_role の鍵を使うため）
import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// URLそのものの期限（秒）。1日
const EXPIRES_IN = 60 * 60 * 24;
// 同じURLを使い回す長さ（秒）。20時間。期限より4時間短くして、
// 画面を開いたまましばらく置いても、切れたURLを返さないようにします
const REUSE_FOR = 60 * 60 * 20;

// 1枚ぶんのURLを作ります。bucket と path が同じなら、20時間は同じ答えを返します
const signOne = unstable_cache(
  async (bucket: string, path: string) => {
    const { data, error } = await createAdminClient()
      .storage.from(bucket)
      .createSignedUrl(path, EXPIRES_IN);
    // 失敗したときは throw します。
    // null を返すと「URLが無い」という答えまで20時間覚えてしまうためです
    if (error || !data) throw new Error(error?.message ?? "URLを作れませんでした");
    return data.signedUrl;
  },
  ["signed-url"],
  { revalidate: REUSE_FOR },
);

// このアプリの public/demo/ に置いた画像か（02_seed.sql のダミーのお祝いの絵など）。
// 保管庫の場所は「<id>/<ファイル名>」の形なので、/ では始まりません。
// これだけは期限付きURLを作らずに、そのまま表示します。
// ▼ 前は http で始まるもの（よそのサイトの画像）も、そのまま表示していました
//   今は DB が「自分のフォルダのファイル」しか入れさせない（01_schema.sql の is_own_file）ので、
//   よその画像が入ることはありませんが、念のため、ここでも出さないようにしています
function isAppAsset(path: string) {
  return path.startsWith("/demo/");
}

// 場所の一覧を受け取り、「場所 → URL」を引ける関数を返します。
// 使い方: const findUrl = await getSignedUrls("posts", paths);  findUrl(post.image_url)
// paths には null が混ざっていてもかまいません（写真の無いご報告など）。
export async function getSignedUrls(bucket: string, paths: (string | null)[]) {
  // 同じ場所が何度も入っていても、作るのは1回ずつにします。
  // アプリの中の画像と、保管庫の場所の形でないもの（http で始まるものなど）は外します
  const unique = Array.from(
    new Set(
      paths.filter(
        (path): path is string =>
          path !== null && !isAppAsset(path) && !path.startsWith("http"),
      ),
    ),
  );

  // 1枚ずつ同時に作ります。覚えているものは通信なしですぐ返ってきます。
  // ▼ まとめて作る命令（createSignedUrls）を使わない理由
  //   まとめて作ると、覚えておく単位が「写真の組み合わせ」になります。
  //   ご報告が1つ増えるだけで組み合わせが変わり、全部の写真が新しい URL になって、
  //   ブラウザが前にダウンロードした写真を使い回せなくなります。
  //   1枚ずつなら、同じ写真にはいつも同じ URL を返せます。
  //   初めての写真のときだけ枚数ぶんの通信になりますが、同時に出すので、待ち時間は1回ぶんほどです
  const urls = await Promise.all(
    unique.map((path) => signOne(bucket, path).catch(() => null)),
  );

  return (path: string | null) => {
    if (!path) return null;
    // 前はアプリの中の画像を渡すと null が返り、ダミーのお祝いが白い四角になっていました
    if (isAppAsset(path)) return path;
    const index = unique.indexOf(path);
    return index === -1 ? null : urls[index];
  };
}
