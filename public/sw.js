// Service Worker（スマホの裏で動く小さなプログラム）です。
// アプリを閉じていても、通知が届いたときにここが目を覚まして、通知を出します。
// サーバーから通知を送る処理は lib/push.ts です。
//
// ▼ 電波が届かないとき
//   画面を開こうとして電波が届かなかったら、端末に保存しておいた offline.html を出します。
//   保存するのは offline.html だけです。ほかの画面（ご報告や手紙など）は保存しません。
//   1台のスマホを何人かで使うこともあるので、人のデータを端末に残さないためです。
const OFFLINE_CACHE = "yukari-offline-v1";
const OFFLINE_URL = "/offline.html";

// 入ったとき：offline.html を保存しておきます
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting()),
  );
});

// 新しい版になったとき：前の版の保存を消して、すぐに今の画面にも効くようにします
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== OFFLINE_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// 画面を開くとき（navigate）だけ見張ります。ふだんはそのままサーバーへ取りに行き、
// 失敗したときだけ offline.html を出します（写真や API の通信には手を出しません）
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then((response) => response || Response.error()),
    ),
  );
});

// 通知が届いたとき
self.addEventListener("push", (event) => {
  let message = { title: "ゆかり", body: "", url: "/" };
  try {
    message = { ...message, ...event.data.json() };
  } catch {
    // 中身が読めなくても、アプリの名前だけで知らせます
  }
  // 押したときに開く画面。アプリの中の "/..." だけを受け付けます
  const url =
    typeof message.url === "string" && message.url.startsWith("/") && !message.url.startsWith("//")
      ? message.url
      : "/";
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: "/apple-icon.png",
      badge: "/apple-icon.png",
      data: { url },
    }),
  );
});

// 通知を押したとき：アプリが開いていればその画面へ、閉じていれば開きます
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const opened = windows.find((client) => "focus" in client);
      if (opened) {
        opened.navigate(url);
        return opened.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
