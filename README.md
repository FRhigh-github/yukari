# ゆかり

大切な人たちのコミュニティの中で、人生の節目（結婚・出産・転職など）を「ご報告」として共有し、
手書きのお祝いを返せるアプリです。しばよこハッカソン 9班。**スマホ専用**です。

- 画面の作りと、コードを書くときの決まりごと … [`AGENTS.md`](AGENTS.md)
- データベースの作り方と、許可（RLS）の決まり … [`supabase/README.md`](supabase/README.md)
- 変更の記録（リリースノート） … [`CHANGELOG.md`](CHANGELOG.md)。いまは **v1.0.0** 🎉

## できること

| 機能 | どこで |
|---|---|
| コミュニティ（招待コードで参加・作成・切り替え） | ホームの左上 |
| ご報告を書く（写真つき） | ホームの右下の紅いボタン |
| ご報告を見る（ストーリー）・手書きのお祝いを返す | ホームのアイコンを押す → 上にスワイプ |
| メッセージカードを送る・届いたカードを見る | 下タブの「カード」/ ホームの左下の「ふみばこ」 |
| 未来への手紙（タイムカプセル）と日程調整・チャット | 下タブの手紙 / ホームの右上の紙飛行機 |
| 最後に話したのは何年前 | ホームのアイコンの「3年」の印・長押し・プロフィール |
| 思い出ログイン（3人のコードで戻る） | ログイン画面の下 |

## 動かす

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm test         # テスト（DB の許可も、手元の Postgres = PGlite で確かめます）
```

GitHub に push すると、lint・型チェック・テスト・ビルドが自動で走ります（`.github/workflows/ci.yml`）。

`.env.local` に次のものを入れます（中身は Supabase のダッシュボードと Vercel にあります。
くわしくは `supabase/README.md` の「鍵について」）。

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # 絶対に NEXT_PUBLIC_ を付けない
RECOVERY_SECRET=...                  # 思い出ログインの署名。32文字以上のでたらめな文字
```

手元でデータベースを作り直すときは、`supabase/README.md` の手順で
`00_reset.sql` → `01_schema.sql` → `02_seed.sql` の順に流します。
**本番では `00_reset.sql` を流しません。** 変更は `supabase/migrations/` の差分だけを流します。
