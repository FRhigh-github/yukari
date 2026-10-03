// 書き終わったあとに、相手のスマホへの通知をサーバーに頼む処理です（app/api/notify）。
// 画面（"use client" のファイル）から使います。
//
// 通知はおまけなので、待たずに頼むだけにします。失敗しても、書いたものはもう届いています。
export function requestNotify(kind: "post" | "card" | "reaction", id: string) {
  fetch("/api/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, id }),
    // keepalive = すぐ次の画面へ移っても、この送信は最後まで届けてもらう指定
    keepalive: true,
  }).catch(() => {
    // 通知が送れなくても、困ることはありません
  });
}
