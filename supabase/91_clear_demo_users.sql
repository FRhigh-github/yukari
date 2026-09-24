-- ============================================================
--  発表の「デモで入る」で作られた、使い捨てのアカウントだけを消す
--
--  「デモで入る」は、押すたびに「ゲスト 123」のようなアカウントを作ります（app/api/demo-login）。
--  そのアカウントは、メールアドレスの最後が @demo.yukari.invalid です。
--  それだけを選んで、残したもの（投稿・お祝い・カードなど）ごと消します。
--  ダミーの10人や、本物のメンバーのアカウントには触りません。
--
--  何度流しても平気です。消すものが無ければ、何も起きません。
-- ============================================================

-- 消す人の一覧（この下で何度も使うので、先に名前を付けておきます）
create temporary table demo_users as
  select id from auth.users where email like '%@demo.yukari.invalid';

-- ------------------------------------------------------------
--  1. 連鎖（on delete cascade）が付いていないものを、先に片づけます
--     （残したままだと「まだ参照されています」と止まります）
-- ------------------------------------------------------------
delete from event_date_options
where event_id in (select id from events where created_by in (select id from demo_users));

delete from events
where created_by in (select id from demo_users);

delete from card_templates
where created_by in (select id from demo_users);

delete from card_sends
where community_id in (select id from communities where created_by in (select id from demo_users));

delete from communities
where created_by in (select id from demo_users);

-- ------------------------------------------------------------
--  2. アカウントを消します。
--     プロフィール・参加・投稿・お祝い・カード・手紙などは、連鎖で一緒に消えます
-- ------------------------------------------------------------
delete from auth.users
where id in (select id from demo_users);

drop table demo_users;
