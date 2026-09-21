-- ============================================================
--  デバッグ用のデータ
--
--  使い方: Supabase ダッシュボード → SQL Editor に全文を貼って Run
--  schema.sql を流したあとに実行してください。
--
--  最初に前回のぶんを消してから入れ直すので、
--  何度 Run しても増えませんし、中身を書き換えて流し直せます。
--  自分の本物のアカウントやコミュニティには触りません。
-- ============================================================


-- ------------------------------------------------------------
--  0. 前回のダミーデータを消す
--
--  多くのテーブルは on delete cascade が付いているので、
--  親を消すと、ぶら下がっているものはまとめて消えます。
--  例: communities を消す → posts → post_reactions まで連鎖。
--
--  ただし card_sends / interactions / time_capsules には
--  それが付いていません（schema.sql を確認）。
--  そのため、これらを先に消しておかないと
--  「まだ参照されています」と怒られて止まります。
--
--  id の頭を固定してあるので、「11111111 で始まるもの」だけを狙えます。
-- ------------------------------------------------------------

-- 先に、連鎖してくれないものを片づける
delete from card_sends
 where community_id::text like '22222222%'
    or from_user::text like '11111111%'
    or to_user::text like '11111111%';

delete from time_capsules
 where community_id::text like '22222222%'
    or author_id::text like '11111111%';

delete from interactions
 where user_a::text like '11111111%'
    or user_b::text like '11111111%';

-- ここから本体
delete from communities where id::text like '22222222%';
delete from auth.users   where id::text like '11111111%';

--  動作確認で作って、誰もいなくなったコミュニティの片づけ。
--  メンバーが1人もいない＝もう誰からも見えないので、消してかまいません。
--  こちらも、先に card_sends を外しておきます。
delete from card_sends
 where community_id in (
   select c.id from communities c
    where not exists (select 1 from memberships m where m.community_id = c.id)
 );

delete from communities c
 where not exists (
   select 1 from memberships m where m.community_id = c.id
 );


-- ------------------------------------------------------------
--  1. ダミーのユーザー（8人）
--
--  profiles.id は auth.users(id) を参照しているので、
--  profiles に直接 insert することはできません。
--  先に auth.users へ入れると、schema.sql の on_auth_user_created が
--  profiles を自動で作ってくれます。
--
--  raw_user_meta_data の full_name / avatar_url が、
--  そのまま profiles の display_name / avatar_url になります。
--  アイコンは全員に入れてあります。
-- ------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-000000000001', 'authenticated', 'authenticated', 'debug01@example.com', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"齋藤 健介","avatar_url":"https://i.pravatar.cc/150?img=12"}'),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-000000000002', 'authenticated', 'authenticated', 'debug02@example.com', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"山田 太郎","avatar_url":"https://i.pravatar.cc/150?img=33"}'),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-000000000003', 'authenticated', 'authenticated', 'debug03@example.com', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"佐藤 美咲","avatar_url":"https://i.pravatar.cc/150?img=45"}'),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-000000000004', 'authenticated', 'authenticated', 'debug04@example.com', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"鈴木 一郎","avatar_url":"https://i.pravatar.cc/150?img=52"}'),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-000000000005', 'authenticated', 'authenticated', 'debug05@example.com', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"高橋 結衣","avatar_url":"https://i.pravatar.cc/150?img=24"}'),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-000000000006', 'authenticated', 'authenticated', 'debug06@example.com', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"田中 蓮","avatar_url":"https://i.pravatar.cc/150?img=60"}'),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-000000000007', 'authenticated', 'authenticated', 'debug07@example.com', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"中村 陽菜","avatar_url":"https://i.pravatar.cc/150?img=31"}'),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-000000000008', 'authenticated', 'authenticated', 'debug08@example.com', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"小林 大輔","avatar_url":"https://i.pravatar.cc/150?img=68"}');


-- ------------------------------------------------------------
--  2. コミュニティ（2つ）
-- ------------------------------------------------------------

insert into communities (id, name, invite_code, created_by)
values
  ('22222222-2222-4222-8222-000000000001', 'しばよこ大学男子バレー部', 'VOLLEY9', '11111111-1111-4111-8111-000000000001'),
  ('22222222-2222-4222-8222-000000000002', '高校の同級生',             'HIGH123', '11111111-1111-4111-8111-000000000002');


-- ------------------------------------------------------------
--  3. 参加メンバー
--
--  ここが大事です。
--  posts も communities も「メンバーしか読めない」設定なので、
--  自分がメンバーになっていないと、アプリ側で何も見えません。
--
--  なので「今この DB にいる profiles 全員」を1つめに参加させます。
--  こうしておけば、チームの誰がログインしても中身が見えます。
-- ------------------------------------------------------------

insert into memberships (user_id, community_id, role)
select id, '22222222-2222-4222-8222-000000000001', 'member'
  from profiles
on conflict (user_id, community_id) do nothing;

-- 2つめはダミー4人だけ。コミュニティ切り替えの確認用です。
insert into memberships (user_id, community_id, role)
select id, '22222222-2222-4222-8222-000000000002', 'member'
  from profiles
 where id::text like '1111111%'
   and id <= '11111111-1111-4111-8111-000000000004'
on conflict (user_id, community_id) do nothing;


-- ------------------------------------------------------------
--  4. ご報告（投稿）
--
--  8人のうち 4人だけに投稿を持たせています。
--  ホーム画面で「光るマル（内側）」と「光らないマル（外側）」の
--  両方を確認できるようにするためです。
--
--  ▼ image_url について
--  本来は Storage に入れた画像の「置き場所」が入ります。
--  ただし SQL から画像そのものを置くことはできないので、
--  デバッグ用データでは、代わりに外部の画像URLを直接入れています。
--  アプリ側は「http で始まっていたら、そのまま画像として使う」作りにしてあります。
-- ------------------------------------------------------------

insert into posts (id, author_id, community_id, title, body, image_url, created_at)
values
  ('33333333-3333-4333-8333-000000000001',
   '11111111-1111-4111-8111-000000000001',
   '22222222-2222-4222-8222-000000000001',
   'プロポーズ成功', 'プロポーズ成功しました！みんな結婚式来てね',
   'https://picsum.photos/seed/yukari-propose/600/450',
   now() - interval '1 day'),

  ('33333333-3333-4333-8333-000000000002',
   '11111111-1111-4111-8111-000000000002',
   '22222222-2222-4222-8222-000000000001',
   '結婚しました！！', '大学で出会った彼女と入籍しました。これからよろしく',
   'https://picsum.photos/seed/yukari-wedding/600/450',
   now() - interval '3 days'),

  ('33333333-3333-4333-8333-000000000003',
   '11111111-1111-4111-8111-000000000003',
   '22222222-2222-4222-8222-000000000001',
   '転職します', '4月から新しい会社で働きます。東京に引っ越すので遊びに来てください',
   'https://picsum.photos/seed/yukari-office/600/450',
   now() - interval '6 days'),

  ('33333333-3333-4333-8333-000000000004',
   '11111111-1111-4111-8111-000000000004',
   '22222222-2222-4222-8222-000000000001',
   '子どもが生まれました', '3200g の女の子です。名前は まだ考え中',
   'https://picsum.photos/seed/yukari-baby/600/450',
   now() - interval '10 days'),

  -- 同じ人が複数の報告を持つ場合の確認用
  ('33333333-3333-4333-8333-000000000005',
   '11111111-1111-4111-8111-000000000001',
   '22222222-2222-4222-8222-000000000001',
   '家を買いました', '横浜にマンションを買いました。引っ越し手伝ってくれる人募集',
   'https://picsum.photos/seed/yukari-house/600/450',
   now() - interval '20 days');


-- ------------------------------------------------------------
--  5. カードのテンプレート
--
--  メッセージカード（/cards）用です。まだ画面は作っていませんが、
--  card_sends がこれを参照するので、先に入れておきます。
--  報告への手書きリアクションは post_reactions なので、これとは別物です。
-- ------------------------------------------------------------

insert into card_templates (id, kind, name, image_url, created_by)
values
  ('44444444-4444-4444-8444-000000000001', 'custom',   '白紙',     'blank.png',    null),
  ('44444444-4444-4444-8444-000000000002', 'newyear',  '年賀状',   'newyear.png',  null),
  ('44444444-4444-4444-8444-000000000003', 'birthday', 'お誕生日', 'birthday.png', null)
on conflict (id) do nothing;


-- ============================================================
--  確認用（選んで実行すると中身が見られます）
-- ============================================================

-- select display_name from profiles order by created_at;
-- select title, created_at from posts order by created_at desc;
-- select name, invite_code from communities;


-- ============================================================
--  ▼ 手書きのリアクションについて
--
--  post_reactions は、SQL では入れていません。
--  絵そのものは Storage に置く必要があるうえ、
--  それらしい手書きは、実際にアプリから2〜3枚描いたほうが
--  デモの見栄えが良いためです。
--  /members/... を開いて「反応する」から描いてみてください。
-- ============================================================
