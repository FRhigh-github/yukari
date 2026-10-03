// Service Worker（スマホの裏で動く小さなプログラム）です。
// アプリを閉じていても、通知が届いたときにここが目を覚まして、通知を出します。
// サーバーから通知を送る処理は lib/push.ts です。

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
