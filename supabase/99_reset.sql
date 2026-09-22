-- ============================================================
--  まっさらにする
--
--  ▼ 危険です。戻せません。
--    アカウント・投稿・カード・コミュニティ、すべて消えます。
--    ファイル名を 99 にしてあるのは、並びの最後に置いて
--    間違って開きにくくするためです。
--
--  使うのは「作り直すとき」だけです。
--  ふだんの入れ直しは seed.sql だけで足ります（あちらも中で全部消します）。
--
--  使い方
--    1. このファイルを流す
--    2. 01_schema.sql を流す
--    3. seed.sql を流す
--    4. 保管庫（Storage）のバケットを作る ← SQLでは作れません
--         avatars   公開
--         posts     非公開
--         drawings  非公開
--         cards     非公開
-- ============================================================


-- ------------------------------------------------------------
--  1. テーブル・型・関数をまとめて消す
--
--  public というまとまりごと捨てて、作り直します。
--  1つずつ drop table すると、参照の順番を全部書くことになるためです。
--
--  ▼ アカウントより先に、こちらを消します
--    逆にすると「events がまだこの人を参照しています」と怒られます。
--    events.created_by のように、わざと連鎖を付けていない列があるためです
--    （作った人が抜けても、予定は残るようにしてあります）。
--
--    public を先に捨てれば、参照している表ごと消えるので、
--    順番を気にする必要がなくなります。
-- ------------------------------------------------------------

drop schema public cascade;
create schema public;


-- ------------------------------------------------------------
--  2. アカウントを消す
-- ------------------------------------------------------------

delete from auth.users;


-- ------------------------------------------------------------
--  3. 権限を戻す
--
--  作り直した public は、誰も触れない状態で生まれます。
--  アプリ（anon / authenticated）とサーバー（service_role）が
--  使えるように、権限を付け直します。
--  これを忘れると、01_schema.sql を流しても何も動きません。
-- ------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
