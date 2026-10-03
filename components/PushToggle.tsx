// 「スマホに通知を受け取る」の切り替えです。自分のプロフィール画面に置きます。
//
// ▼ 受け取れる端末
//   iPhone は、Safari の「ホーム画面に追加」で入れたアプリからだけ受け取れます（iOS 16.4 から）。
//   受け取れない端末では、このボタンを出しません。
//
// ▼ しくみ
//   1. 端末に Service Worker（public/sw.js）を入れる
//   2. ブラウザに「この端末の宛先」を作ってもらう（pushManager.subscribe）
//   3. 宛先をサーバーに保存する（app/api/push/subscribe）
//   通知を送るのはサーバーです（lib/push.ts）。

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 公開鍵は「base64url」という文字の形で渡されるので、ブラウザが受け取れる形（バイトの並び）に直します
function toKeyBytes(base64url: string) {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export default function PushToggle() {
  // null = まだ調べている / "unsupported" = この端末では受け取れない / "on" / "off"
  const [state, setState] = useState<"unsupported" | "on" | "off" | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 画面を開いたときに、この端末がもう受け取る設定になっているかを調べます
  useEffect(() => {
    const check = async () => {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      ) {
        setState("unsupported");
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      setState(subscription ? "on" : "off");
    };
    check();
  }, []);

  const turnOn = async () => {
    setIsBusy(true);
    setMessage(null);
    try {
      // 通知の許可を聞きます（押したときにしか聞けない決まりなので、ここで聞きます）
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("通知が許可されていません。端末の設定から許可してください");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        // 届いたら必ず通知を出す、という約束（ブラウザの決まりで必須です）
        userVisibleOnly: true,
        applicationServerKey: toKeyBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""),
      });
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error("保存できませんでした");
      setState("on");
    } catch (error) {
      console.error("通知を受け取る設定にできませんでした", error);
      setMessage("設定できませんでした。もう一度お試しください");
    } finally {
      setIsBusy(false);
    }
  };

  const turnOff = async () => {
    setIsBusy(true);
    setMessage(null);
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      // サーバーの宛先を消してから、端末の宛先も消します（自分の分しか消えません。DB の許可）
      await createClient().from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
      await subscription.unsubscribe();
    }
    setState("off");
    setIsBusy(false);
  };

  if (state === null || state === "unsupported") return null;

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={state === "on" ? turnOff : turnOn}
        disabled={isBusy}
        className="flex h-12 w-full items-center justify-between rounded-xl bg-white px-4 text-sm text-stone-700 ring-1 ring-kin/30 disabled:opacity-50"
      >
        スマホに通知を受け取る
        {/* オン・オフのつまみ */}
        <span
          aria-hidden="true"
          className={`flex h-7 w-12 items-center rounded-full p-0.5 transition-colors ${
            state === "on" ? "justify-end bg-beni" : "justify-start bg-stone-300"
          }`}
        >
          <span className="h-6 w-6 rounded-full bg-white shadow" />
        </span>
      </button>
      {message ? <p className="text-center text-sm text-beni">{message}</p> : null}
    </div>
  );
}
