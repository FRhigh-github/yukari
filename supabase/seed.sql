-- ============================================================
--  デバッグ用のデータ
--
--  使い方: Supabase ダッシュボード → SQL Editor に全文を貼って Run
--  schema.sql を流したあとに実行すること。
--
--  何度 Run しても大丈夫なように作ってあります（id を固定してあるため）。
--  消したいときは、一番下の「片づけ」を使ってください。
-- ============================================================


-- ------------------------------------------------------------
--  1. ダミーのユーザー
--
--  profiles.id は auth.users(id) を参照しているので、
--  profiles に直接 insert することはできません。
--  先に auth.users に入れると、schema.sql で作った
--  on_auth_user_created トリガーが profiles を自動で作ってくれます。
--
--  raw_user_meta_data に入れた full_name / avatar_url が、
--  そのまま profiles の display_name / avatar_url になります。
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
  -- ▼ ここから下は avatar_url を入れていません。
  --   画像が無い人のマルがどう出るか、確認するためです。
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-000000000005', 'authenticated', 'authenticated', 'debug05@example.com', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"高橋 結衣"}'),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-000000000006', 'authenticated', 'authenticated', 'debug06@example.com', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"田中 蓮"}'),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-000000000007', 'authenticated', 'authenticated', 'debug07@example.com', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"中村 陽菜"}'),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-000000000008', 'authenticated', 'authenticated', 'debug08@example.com', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"小林 大輔"}')
on conflict (id) do nothing;


-- ------------------------------------------------------------
--  2. コミュニティ
-- ------------------------------------------------------------

insert into communities (id, name, invite_code, created_by)
values
  ('22222222-2222-4222-8222-000000000001', 'しばよこ大学男子バレー部', 'VOLLEY9', '11111111-1111-4111-8111-000000000001'),
  ('22222222-2222-4222-8222-000000000002', '高校の同級生',             'HIGH123', '11111111-1111-4111-8111-000000000002')
on conflict (id) do nothing;


-- ------------------------------------------------------------
--  3. 参加メンバー
--
--  ここが大事です。
--  posts も communities も「メンバーしか読めない」設定なので、
--  自分がメンバーになっていないと、アプリ側で何も見えません。
--
--  なので「今この DB にいる profiles 全員」を、
--  1つめのコミュニティに参加させています。
--  こうしておけば、誰がログインしても中身が見えます。
-- ------------------------------------------------------------

insert into memberships (user_id, community_id, role)
select id, '22222222-2222-4222-8222-000000000001', 'member'
  from profiles
on conflict (user_id, community_id) do nothing;

-- 2つめのコミュニティは、ダミー4人だけにしておきます。
-- （コミュニティを切り替える動きを試すため）
insert into memberships (user_id, community_id, role)
select id, '22222222-2222-4222-8222-000000000002', 'member'
  from profiles
 where id in (
   '11111111-1111-4111-8111-000000000001',
   '11111111-1111-4111-8111-000000000002',
   '11111111-1111-4111-8111-000000000003',
   '11111111-1111-4111-8111-000000000004'
 )
on conflict (user_id, community_id) do nothing;


-- ------------------------------------------------------------
--  4. ご報告（投稿）
--
--  8人のうち 4人だけに投稿を持たせています。
--  ホーム画面で「光るマル」と「光らないマル」の
--  両方が見えるようにするためです。
--
--  投稿を持っている人: 齋藤 / 山田 / 佐藤 / 鈴木
--  持っていない人    : 高橋 / 田中 / 中村 / 小林
-- ------------------------------------------------------------

insert into posts (id, author_id, community_id, title, body, created_at)
values
  ('33333333-3333-4333-8333-000000000001',
   '11111111-1111-4111-8111-000000000001',
   '22222222-2222-4222-8222-000000000001',
   'プロポーズ成功', 'プロポーズ成功しました！みんな結婚式来てね',
   now() - interval '1 day'),

  ('33333333-3333-4333-8333-000000000002',
   '11111111-1111-4111-8111-000000000002',
   '22222222-2222-4222-8222-000000000001',
   '結婚しました！！', '大学で出会った彼女と入籍しました。これからよろしく',
   now() - interval '3 days'),

  ('33333333-3333-4333-8333-000000000003',
   '11111111-1111-4111-8111-000000000003',
   '22222222-2222-4222-8222-000000000001',
   '転職します', '4月から新しい会社で働きます。東京に引っ越すので遊びに来てください',
   now() - interval '6 days'),

  ('33333333-3333-4333-8333-000000000004',
   '11111111-1111-4111-8111-000000000004',
   '22222222-2222-4222-8222-000000000001',
   '子どもが生まれました', '3200g の女の子です。名前は まだ考え中',
   now() - interval '10 days'),

  -- 同じ人が複数の報告を持っている場合も確認できるように、もう1件
  ('33333333-3333-4333-8333-000000000005',
   '11111111-1111-4111-8111-000000000001',
   '22222222-2222-4222-8222-000000000001',
   '家を買いました', '横浜にマンションを買いました。引っ越し手伝ってくれる人募集',
   now() - interval '20 days')
on conflict (id) do nothing;


-- ------------------------------------------------------------
--  5. カードのテンプレート
--     /draw の送信先として card_sends を使っているので、
--     テンプレートが1件も無いと保存に失敗します。
-- ------------------------------------------------------------

insert into card_templates (id, kind, name, image_url, created_by)
values
  ('44444444-4444-4444-8444-000000000001', 'custom',   '白紙',       'blank.png',    null),
  ('44444444-4444-4444-8444-000000000002', 'newyear',  '年賀状',     'newyear.png',  null),
  ('44444444-4444-4444-8444-000000000003', 'birthday', 'お誕生日',   'birthday.png', null)
on conflict (id) do nothing;


-- ============================================================
--  確認用
--  Run したあと、これを選んで実行すると中身が見られます。
-- ============================================================

-- select display_name, avatar_url from profiles order by created_at;
-- select title, created_at from posts order by created_at desc;


-- ============================================================
--  片づけ（消したくなったとき）
--
--  auth.users を消すと、profiles → memberships → posts の順に
--  まとめて消えます（schema.sql で on delete cascade になっているため）。
--  下の3行の先頭の -- を外して Run してください。
-- ============================================================

-- delete from card_templates where id::text like '44444444%';
-- delete from communities     where id::text like '22222222%';
-- delete from auth.users      where id::text like '11111111%';
