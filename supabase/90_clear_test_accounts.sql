-- ============================================================
--  テストで作ったアカウントだけ消す
--
--  ログインとサインアップを何度も試すためのものです。
--  ダミーの10人（seed.sql が作ったもの）は残るので、
--  相関図も投稿もそのままです。
--
--  ▼ 見分け方
--    seed.sql のダミーは id が 11111111… で始まります。
--    それ以外＝画面から登録したアカウント、とみなして消します。
--
--  何度流しても平気です。消すものが無ければ、何も起きません。
-- ============================================================


-- ------------------------------------------------------------
--  1. その人が残したものを先に片づける
--
--  連鎖（on delete cascade）が付いていない列があるので、
--  残したままだと「まだ参照されています」と止まります。
--  events.created_by などが、わざと付けていない列です。
-- ------------------------------------------------------------

-- 予定まわり
-- ::text は「文字として扱う」という指定です。
-- uuid のままだと like で比べられません。
delete from event_responses
where user_id::text not like '11111111%';

delete from event_date_options
where event_id in (select id from events where created_by::text not like '11111111%');

delete from events
where created_by::text not like '11111111%';

-- 作ったコミュニティ。
-- メンバーごと消えるので、テスト用に作った班はきれいに無くなります。
delete from card_sends
where community_id in (
  select id from communities where created_by::text not like '11111111%'
);

delete from communities
where created_by::text not like '11111111%';

-- 復旧の途中だったもの
delete from recovery_codes
where target_user::text not like '11111111%'
   or issued_by::text not like '11111111%';


-- ------------------------------------------------------------
--  2. アカウントを消す
--
--  profiles / memberships / posts などは連鎖で一緒に消えます。
-- ------------------------------------------------------------

delete from auth.users
where id::text not like '11111111%';


-- ------------------------------------------------------------
--  3. 確認
--
--  残ったアカウントの数を出します。10人になっていれば成功です。
-- ------------------------------------------------------------

select count(*) as 残ったアカウント数 from auth.users;
