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
| `/` | ホーム。メンバーのマルが並ぶ。まだ見ていない報告がある人は光る。右下にステータス（会いたい / 多忙）、1年以上やりとりが無い人は右上に「3年」の印 |
| `/members/[id]` | その人のご報告（ホームから来たときは、いきなりストーリーで開く）。上スワイプで手書きのお祝い |
| `/members/[id]/profile` | その人のプロフィールと「最後にやりとりしたのは〜」。ホームでアイコンを長押しして開く |
| `/post` | ご報告を書く。`?c=` で最初に選ぶコミュニティを渡す |
| `/cards` | 背景をえらぶ（DBに聞かない。`CARD_KINDS` から出している） |
| `/cards/new` | カードを作る。送る相手は「送る」を押してから取りに行く |
| `/cards/inbox` | 届いた / 送ったカード |
| `/letter` | 未来への手紙を書く（別の人が担当） |
| `/letters/[id]` | 届いた（開封日を過ぎた）手紙を読む。ホームの紙飛行機から |
| `/events/[id]` `/events/[id]/chat` | 手紙に付いた日程調整と、そのチャット |
| `/chats` | チャットの一覧。ホームの上のふきだしから |
| `/profile` `/profile/edit` | 自分のプロフィール |
| `/signup` `/login` `/setup` `/start` | 登録 / ログイン / 名前と誕生日の入力 / 最初のコミュニティ選び |
| `/recover` | 思い出ログイン（下に説明あり） |
| `/communities/new` `/communities/join` | コミュニティを作る / 招待コードで参加 |
| `/communities/[id]` | コミュニティの設定。ホームの切り替えの ⚙ から |

下タブは `components/BottomNav.tsx`。
タブを出す画面は、その中の `SHOW_NAV` に並べた4つだけ（それ以外の画面は戻るボタンで帰る）。

思いがけないエラーのときは `app/error.tsx`、無い URL のときは `app/not-found.tsx` が出る。

コミュニティの切り替えは `components/CommunitySwitcher.tsx`。
**「すべてのコミュニティ」は無い。** 常にどれか1つを見ている状態にする
（別のコミュニティの人が同じ相関図に混ざると、今どこを見ているのか分からなくなるため）。

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

Supabase。**手順と決まりごとは `supabase/README.md` にまとめてある。**

```
supabase/00_reset.sql             まっさらにする（危険。全アカウントも消える）
supabase/01_schema.sql            土台（テーブル・型・RLS・関数・トリガー・保管庫）
supabase/02_seed.sql              ダミーの10人と中身。流し直すとダミーだけ入れ替わる
supabase/03_clear_demo_guests.sql 「デモで入る」のゲストを消す（発表後）
```

SQL はこの4つだけ。**許可を足すときは、ダッシュボードから足さずに `01_schema.sql` に書く。**

**RLS（行レベルセキュリティ）が本体。**
画面側の `if` 文ではなく、DB 側が「誰に何を見せるか」を判断している。

- `posts` / `communities` は **そのコミュニティのメンバーしか読めない**
- `profiles` は **自分と、同じコミュニティにいる人しか読めない**
  → ホームでメンバーを出すときは `memberships` で絞る（`lib/home.ts`）
- `time_capsules` は **開封日を過ぎた行しか返ってこない**（書いた本人は別）。画面側では一切制御しない
- `messages`（チャット）は **そのイベントが見える人しか読めない**
- `recovery_codes` は **発行した本人しか読めない**
- `interactions`（最後に話した日）は **画面からは書けない**。カード・お祝い・チャットを送ると、DB のトリガーが記録する
- デモのゲスト（`@demo.yukari.invalid`）は、コミュニティの作成・参加・退出・名前やアイコンの変更ができない（`is_demo_guest`）

テーブルを増やしたら、RLS の設定も必ず書くこと。
書き忘れると、鍵を持っている人（＝アプリを開いた全員）が中身を全部読み書きできる。

**決まった選択肢（enum）が5つある。** `member_role` や `card_kind` など。
`card_kind` は画面の `CARD_KINDS`（`components/CardTemplate.tsx`）とそろえること。
ここに無い値を入れようとすると DB が受け付けない。`01_schema.sql` の先頭を見ること。

## 思い出ログイン

メールもパスワードも失った人が、仲間の力で戻ってくる仕組み。

```
① 同じコミュニティの3人が、それぞれコードを発行（別々の6文字）
   → その人のプロフィール画面（/members/[id]/profile）から
② 本人が3つとも入れる（/recover）→ 申請が立つ
③ コミュニティ全員に知らせが出る。24時間、誰でも止められる
④ 誰も止めなければ、24時間後にログインできる
```

**照合はサーバー側でしかできない。** 本人はまだログインしていないので、
RLS の外にいる。`app/api/recovery/` が `SUPABASE_SERVICE_ROLE_KEY` を使って判定する。

`lib/supabase/admin.ts` は **`"use client"` のファイルから読み込まないこと。**
読み込むと鍵がブラウザに配られ、誰でも DB を全部読み書きできる状態になる。

## いま分かっている宿題

- 通知の鐘（`NotificationBell`）はアプリの中の「お知らせ」一覧。スマホへのプッシュ通知は送っていない
- ダミーデータのアイコンとご報告の絵は public/demo/ に置いてある（外部のサービスは使っていない）
- ログアウトは自分のプロフィール（`/profile`）のいちばん下。ログインしたまま `/login` を開くとホームへ戻る
- `useEffect` の中で、描き直すたびに作り直される関数を呼ぶときは `useEffectEvent` で包む
  （日程調整・チャットの画面を参照。依存から外すと lint の警告になる）

## コードの書き方

このリポジトリは、Web 開発を始めたばかりのメンバーが読む前提で書かれている。

- **コメントは日本語で、「なぜ」を書く**。既存のファイルがその書き方になっている
- カスタムフックや状態管理ライブラリは使わない。
  `useState` / `async-await` / `.map()` / 三項演算子 / `?.` の範囲で書く
- 一度に大きく変えない。1つの変更で1つのことだけ直す
