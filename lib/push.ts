// スマホへの通知（プッシュ通知）を送る処理です。サーバー側からだけ使います。
//
// ▼ しくみ
//   1. 見る人が「通知を受け取る」を押すと、ブラウザがその端末の宛先（endpoint）をくれます。
//      それを push_subscriptions に保存しておきます（app/api/push/subscribe）
//   2. 知らせたいことが起きたら、ここから宛先に送ります。
//      届くと、端末の Service Worker（public/sw.js）が通知を出します
//   送るときは VAPID という鍵で署名します（環境変数 NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY）。
//   鍵が無いときは、何もしません（通知はアプリの必須の機能ではないため）
// server-only = "use client" の側から読み込むと、ビルドの時点でエラーにする印です（鍵を使うため）
import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushMessage = {
  title: string;
  body: string;
  // 通知を押したときに開く画面（アプリの中の "/..." だけ）
  url: string;
};

// 同じものについて、二度送らないための印を付けます。
// 初めてなら true（送ってよい）、もう送っていれば false
export async function claimPush(kind: string, refId: string) {
  const { error } = await createAdminClient().from("push_log").insert({ kind, ref_id: refId });
  return error === null;
}

export async function sendPush(userIds: string[], message: PushMessage) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject || userIds.length === 0) return;
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const admin = createAdminClient();
  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds);

  await Promise.all(
    (subscriptions ?? []).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(message),
        );
      } catch (error) {
        // 404 / 410 = その端末は通知をやめた（アプリを消したなど）。宛先を消します
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
          return;
        }
        console.error("通知を送れませんでした", error);
      }
    }),
  );
}
