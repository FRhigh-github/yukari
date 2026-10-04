// Service Worker（public/sw.js）を、アプリを開いた人の端末に入れる部品です。
// 画面には何も出しません。app/layout.tsx に1つだけ置きます。
//
// 入れておくと、電波が届かないときに「電波が届いていません」の画面（public/offline.html）が出ます。
// （通知を受け取る設定でも、同じ Service Worker を使います。components/PushToggle.tsx）

"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      // 入れられなくても、アプリはふつうに使えます
      console.error("Service Worker を入れられませんでした", error);
    });
  }, []);
  return null;
}
