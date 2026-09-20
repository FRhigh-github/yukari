// app/touchtest/page.tsx
//
// iPhone で何が起きているかを調べるための、確認用ページです。
// 原因が分かったら削除してかまいません。
//
// 調べるのは3つです。
//   ・JavaScript のエラーが出ていないか
//   ・素の JavaScript が動くか
//   ・React が動くか
// どこまで動くかで、原因の場所が絞れます。

"use client";

import { useState } from "react";

// ▼ エラーを画面に出すための仕組み
// iPhone のエラーは、Windows のパソコンからは見られません。
// そこで、エラーが起きたら、それを画面の文字として出すようにします。
//
// window.addEventListener("error", ...) は、
// 「このページでエラーが起きたら教えて」という指定です。
// unhandledrejection は、待ち処理(Promise)の中で起きた失敗を拾います。
//
// この文字列は、React ではなく、素の JavaScript としてページに埋め込みます。
// React が動かない状況でも、これだけは動いてほしいからです。
const errorCatcher = `
(function () {
  function show(text) {
    var box = document.getElementById("errbox");
    if (box) { box.textContent = text; }
  }
  window.addEventListener("error", function (e) {
    show("ERROR: " + (e.message || "") + " @ " + (e.filename || "") + ":" + (e.lineno || ""));
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    show("REJECT: " + (r && r.message ? r.message : String(r)));
  });
})();
`;

// ▼ 素の JavaScript で動くボタン
// React をいっさい通さず、HTML に直接書いたボタンです。
// これが動けば「JavaScript 自体は動いている」と分かります。
// 動かなければ、ページに JavaScript が届いていません。
const plainButton = `
<button type="button" style="padding:10px 16px;font-size:16px"
  onclick="document.getElementById('plainresult').textContent='素のJSは動いた'">
  素のJSテスト
</button>
<p id="plainresult" style="font-size:14px">まだ押していません</p>
`;

export default function TouchTestPage() {
  const [count, setCount] = useState(0);

  return (
    <main style={{ padding: "16px" }}>
      <h1>動作テスト</h1>

      {/*
        dangerouslySetInnerHTML は「この文字を、HTMLとしてそのまま埋め込む」指定です。
        名前が物騒なのは、外から来た文字を入れると危ないからです。
        ここでは自分で書いた文字だけを入れているので、問題ありません。
      */}
      <script dangerouslySetInnerHTML={{ __html: errorCatcher }} />

      <p
        id="errbox"
        style={{ color: "red", fontSize: "13px", wordBreak: "break-all" }}
      >
        エラーなし
      </p>

      <hr />

      <p style={{ fontSize: "14px" }}>① 素のJavaScript</p>
      <div dangerouslySetInnerHTML={{ __html: plainButton }} />

      <hr />

      <p style={{ fontSize: "14px" }}>② React</p>
      <button
        type="button"
        onClick={() => setCount(count + 1)}
        style={{ padding: "10px 16px", fontSize: "16px" }}
      >
        Reactテスト
      </button>
      <p style={{ fontSize: "14px" }}>押した回数: {count}</p>
    </main>
  );
}
