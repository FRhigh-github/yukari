<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# ゆかり / プロジェクトの決まりごと

> ここから下は自分たちで書いた部分です。
> 上のブロックは `next dev` が自動で書き換えますが、
> マーカー（`<!-- END:nextjs-agent-rules -->`）より下は消えません。

## これは何のアプリか

しばよこハッカソン9班。コンセプトは「終わらない」。
大切な人たちのコミュニティの中で、人生の節目（結婚・出産・転職など）を
「ご報告」として共有し、手書きのお祝いを返せるアプリ。

**スマホ専用**として作る。PCで見たときは、スマホ幅の1枚を画面中央に置くだけ。
レスポンシブ対応はしない。

## 画面の作り

| URL | 中身 |
|---|---|
| `/` | ホーム。メンバーのマルが並ぶ。報告がある人は光る |
| `/members/[id]` | その人のご報告一覧 |
| `/post` | ご報告を書く |
| `/draw` | 手書きのお祝いを描く |
| `/cards` `/capsules` | メッセージカード / 未来への手紙（未着手） |
| `/profile` | プロフィール（別の人が担当） |
| `/login` `/join` | ログイン / 招待コードでコミュニティ参加 |

下タブは `components/BottomNav.tsx`。
タブを出したくない画面は、その中の `HIDE_NAV` に URL を足す。

## 見た目のルール（iOS の Human Interface Guidelines より）

参考: https://developer.apple.com/design/human-interface-guidelines/

- **押せるものは 44×44px 以上**。見た目が小さくても、当たり判定は 44px 確保する。
  これを守るだけで「ちゃんとしたアプリ感」がかなり出る
- 画面の左右の余白は **16px**（Tailwind の `px-4`）。今は `px-5`(20px) も混在
- 下タブの高さは **49px** が iOS の基準
- カードの角丸は **10〜16px**（`rounded-xl` 〜 `rounded-2xl`）
- 本文の文字は **17px** が iOS の標準。10px より小さくしない
- フォントは `-apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif`。
  iPhone で見たときに本物のシステムフォントになる

## データベース

Supabase。スキーマは `supabase/schema.sql`、デバッグ用データは `supabase/seed.sql`。

**RLS（行レベルセキュリティ）が本体。**
画面側の `if` 文ではなく、DB 側が「誰に何を見せるか」を判断している。

- `posts` / `communities` は **そのコミュニティのメンバーしか読めない**
- `profiles` は **誰でも全員分読める**（`using (true)`）
  → ホームでメンバーを出すときは `memberships` で絞る必要がある。**現状これができていない**
- `time_capsules` は **開封日を過ぎた行しか返ってこない**。画面側では一切制御しない

テーブルを増やしたら、RLS の設定も必ず書くこと。

## いま分かっている宿題

- ホーム（`app/page.tsx`）が `profiles` を全件取っている。`memberships` で絞る
- `DrawingPad.tsx` が `card_sends` に保存しているが、
  スキーマ的には `post_reactions` が正しい（schema.sql のコメント参照）
- `DrawingPad.tsx` の `COMMUNITY_ID` / `TEMPLATE_ID` が直書き
- `app/post/page.tsx` の `useEffect` 内 `setState` を、サーバー側の取得に直す

## コードの書き方

このリポジトリは、Web 開発を始めたばかりのメンバーが読む前提で書かれている。

- **コメントは日本語で、「なぜ」を書く**。既存のファイルがその書き方になっている
- カスタムフックや状態管理ライブラリは使わない。
  `useState` / `async-await` / `.map()` / 三項演算子 / `?.` の範囲で書く
- 一度に大きく変えない。1つの変更で1つのことだけ直す
