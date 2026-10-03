# データベースのこと

Supabase を使っています。このフォルダには、DB を作り直すための SQL が入っています。
流すときは、Supabase ダッシュボードの **SQL Editor** にファイルの中身をまるごと貼って **Run** します。

## ファイル

| ファイル | 何をするもの | いつ流すか |
|---|---|---|
| `00_reset.sql` | まっさらにする。**全アカウント・全データが消えます** | 作り直すときだけ |
| `01_schema.sql` | 土台。テーブル・関数・許可（RLS）・保管庫・カードの種類 | リセットのあとに1回 |
| `02_seed.sql` | ダミーの10人と、3つのコミュニティの中身 | 01 のあと。発表前にもう一度流すと、日時が新しくなります |
| `04_remove_dummy_data.sql` | 本番から、ダミーの10人・ダミーのコミュニティ・「デモで入る」のゲストを消す | **本番で、公開する前に1回だけ**（migrations を流したあと） |

**許可を足したいときは、ダッシュボードの画面から足さずに SQL のファイルに書いてください。**
画面から足すと、ファイルと本番がずれて、どこに穴があるか分からなくなります（前はそれで「誰でも読める」許可が紛れ込んでいました）。

## 本番の DB を変えるとき（migrations/）

本番には、本物の人のアカウントと思い出が入っています。
`00_reset.sql` から流し直すと全部消えるので、本番では**変更のぶんだけ**を流します。

```
supabase/migrations/<日付>_<番号>_<何を変えるか>.sql
```

DB を変えるときは、次の2か所に同じ変更を書きます。

1. `01_schema.sql` … 「今の正しい形」。新しく作り直すときは、これだけで最新になります
2. `migrations/` に新しいファイルを1つ … 今ある DB を、最新の形に変えるための差分

DB を変えたら、`npm test` で確かめます（`tests/db/`）。
新しく作った DB（01）と、本番の形の DB（`tests/fixtures/schema_before_migrations.sql` に migrations を流したもの）の
両方で同じテストを通すので、01 と migrations がずれていると失敗します。
`tests/fixtures/schema_before_migrations.sql` は、migrations を始める前の本番の形です。書き換えないでください。

本番に流すのは 2 だけです。ファイル名の順（日付と番号の順）に、まだ流していないものを流します。
**どこまで流したかは、下の表に書き足してください。**（流し忘れ・二重に流すのを防ぐため）

| ファイル | 本番に流した日 |
|---|---|
| `2026-10-04_01_own_file_paths.sql` | |
| `2026-10-04_02_strong_invite_codes.sql` | |
| `2026-10-04_03_random_avatar_names.sql` | |
| `2026-10-04_04_allowed_avatar_urls.sql` | |
| `2026-10-04_05_recovery_visible_to_all.sql` | |
| `2026-10-04_06_rate_limits.sql` | |
| `2026-10-04_07_bucket_limits.sql` | |
| `2026-10-04_08_private_letter_events.sql` | |
| `2026-10-04_09_text_length_limits.sql` | |
| `2026-10-04_10_birthday_without_year.sql` | |
| `2026-10-04_11_remove_demo_guests.sql` | |
| `2026-10-04_12_reports_and_blocks.sql` | |
| `2026-10-04_13_delete_own_items.sql` | |
| `2026-10-04_14_owner_handover.sql` | |
| `2026-10-04_15_regenerate_invite_code.sql` | |
| `2026-10-04_16_push_notifications.sql` | |
| `2026-10-04_17_letter_links.sql` | |
| `2026-10-04_18_error_reports.sql` | |
| `2026-10-04_19_app_usage.sql` | |
| `2026-10-04_20_delete_own_photos.sql` | |

## 新しく作り直す手順

```
① 00_reset.sql    まっさらにする（全員サインアップからやり直し）
② 01_schema.sql   土台を作る。最後に許可の一覧が表で出ます
③ 02_seed.sql     ダミーデータを入れる。最後に件数が表で出ます
```

② と ③ は、途中でエラーになると、そのファイルの分は何も入りません（全部入るか、何も入らないか）。
エラーの文を読んで直してから、もう一度流してください。

### 02_seed.sql だけを流し直すと

消えるのはダミーの10人と、その人たちが書いたものだけです。
自分たちで作ったアカウントや投稿、コミュニティの招待コードは残ります。
発表の前日か当日の朝に流し直すと、ご報告の日時が「今」を基準に新しくなります。

## 中身の早見表

| テーブル | 中身 | 誰が読めるか（RLS） |
|---|---|---|
| `profiles` | 名前・誕生日・アイコン・気持ち | 自分と、同じコミュニティの人 |
| `communities` | コミュニティ | メンバー |
| `memberships` | 誰がどこに入っているか | 自分の分と、同じコミュニティの分 |
| `posts` | ご報告 | そのコミュニティのメンバー |
| `post_reactions` | 手書きのお祝い | そのコミュニティのメンバー |
| `card_templates` | カードの種類（7つ） | ログインしている人 |
| `card_sends` | 送ったカード | 送った人と受け取った人 |
| `time_capsules` | 未来への手紙 | 書いた本人。ほかの人は**開封日を過ぎてから** |
| `events` / `event_date_options` / `event_responses` | 手紙に付けた日程調整 | 手紙が開いたあと、そのコミュニティの人 |
| `messages` | 日程調整のチャット | そのイベントが見える人 |
| `interactions` | やりとりの記録（最後に話した日） | 自分が関わった分だけ。**書くのはトリガーだけ** |
| `recovery_codes` / `recovery_requests` / `recovery_vetoes` | 思い出ログイン | 発行した本人 / 復旧しようとしている本人と、同じコミュニティにいる人 |
| `reports` | メンバーについての報告 | 報告した本人と、そのコミュニティの作成者。**書くのは `report_user` だけ** |
| `blocks` | 自分がブロックした人 | 自分の分だけ |

`last_contacts` はビュー（見え方）で、相手ごとの「最後にやりとりした日時」を返します。
`security_invoker = true` を付けているので、見ている人の権限で動き、自分の分しか返りません。

### 「最後に話した日」が記録されるとき

画面からは書けません。次のことをすると、DB のトリガーが自動で記録します。

- カードを送った（送った人 ↔ 受け取った人）
- ご報告にお祝いを描いた（描いた人 ↔ 投稿した人）
- 日程調整のチャットで話した（話した人 ↔ イベントを企画した人）

### 削除したときの動き

アカウントを消すと、その人の投稿・お祝い・カード・手紙・参加などは一緒に消えます。
その人が作ったコミュニティは残り、作成者の欄だけが空になります。

## 保管庫（Storage）

バケットは `01_schema.sql` が作ります（もうあるときは、公開かどうかだけ合わせます）。
ただし、プロジェクトによっては SQL からバケットを作る権限が無く、
流したあとに `NOTICE: バケットを SQL から作る権限がありませんでした` と出ます。
そのときは、ダッシュボードの **Storage → New bucket** で、下の4つを同じ名前・同じ公開設定で作ってください
（01 はそこで止まらずに最後まで流れるので、流し直す必要はありません）。

| 名前 | 公開 | 何を入れるか | 置き場所 | 大きさの上限 | 種類 |
|---|---|---|---|---|---|
| `avatars` | **公開** | プロフィール・コミュニティのアイコン | `<自分の id>/<ランダムな id>.jpg` / `communities/<コミュニティの id>/<ランダムな id>.jpg` | 1MB | `image/jpeg` |
| `posts` | 非公開 | ご報告の写真 | `<自分の id>/<ファイル名>` | 2MB | `image/jpeg` |
| `drawings` | 非公開 | 手書きのお祝い・未来への手紙の紙 | `<自分の id>/<ファイル名>` | 5MB | `image/png` |
| `cards` | 非公開 | メッセージカード | `<自分の id>/<ファイル名>` | 2MB | `image/jpeg` |

`avatars` だけ公開なのは、相関図で全員のアイコンを出すためです。
ほかの3つはコミュニティの中の人にしか見せないものなので、サーバーが期限付きURLを作って見せています（`lib/signedUrls.ts`）。

`00_reset.sql` は、保管庫の写真のファイルそのものは消しません（Supabase では SQL から消せないため）。
消したいときは、ダッシュボードの Storage で各バケットの中身を消してください。残っていても、アプリからは見えません。

## 設定（ダッシュボード側）

SQL に含められない設定です。作り直したときは、ここも確認してください。

```
Authentication → Providers → Email
  Confirm email … OFF（ハッカソン中。本番なら ON に戻す）

Authentication → Providers → Google
  有効にしておく

Authentication → URL Configuration → Redirect URLs
  https://<本番のドメイン>/auth/callback**
  http://localhost:3000/auth/callback**
  （最後の ** は、?next=/reset-password のような後ろの部分も認めるための印です。
    パスワードの再設定のメールから戻ってくるときに使います）
```

## 鍵について

`.env.local` と Vercel の環境変数に入れます。

| 名前 | 置く場所 | 性質 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 両方 | 公開してよい |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 両方 | 公開してよい（RLS が守る） |
| `SUPABASE_SERVICE_ROLE_KEY` | 両方 | **絶対に出さない**。RLS を無視できる |
| `RECOVERY_SECRET` | 両方 | **出さない**。思い出ログインの引換券の署名に使う、32文字以上のでたらめな文字。無いと思い出ログインが動かない（`lib/recoveryTicket.ts`）。作り方：`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 両方 | スマホへの通知の公開鍵（公開してよい）。`VAPID_PRIVATE_KEY` と組で作る。作り方：`npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | 両方 | **出さない**。スマホへの通知の署名に使う秘密の鍵 |
| `VAPID_SUBJECT` | 両方 | 通知サーバーに伝える連絡先。`mailto:運営の連絡用アドレス` か、アプリの https の URL |
| `OPS_EMAIL` | Vercel | 運営者のメールアドレス。この1日のエラー（`error_reports`）と、容量の見張りの知らせが届く。無ければ送らない |
| `DB_LIMIT_MB` / `STORAGE_LIMIT_MB` | Vercel（任意） | 容量の見張りの上限。無ければ無料プランの値（500 / 1024）。有料プランにしたら変える |
| `CRON_SECRET` | Vercel | **出さない**。1日1回の処理（`/api/cron/daily`）を Vercel だけが呼べるようにする合言葉。32文字以上のでたらめな文字 |
| `RESEND_API_KEY` | Vercel | メールを送るサービス（Resend）の鍵。思い出ログインの申請を本人にメールで知らせる。無ければメールは送らない（`lib/mail.ts`） |
| `MAIL_FROM` | Vercel | メールの送り主。例：`ゆかり <noreply@あなたのドメイン>`。Resend で確認したドメインのアドレス |

`NEXT_PUBLIC_` が付いているものはブラウザに配られます。
3つめ（`SUPABASE_SERVICE_ROLE_KEY`）に付けてはいけません。付けると、誰でも DB を全部読み書きできます。

