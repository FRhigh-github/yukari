-- ============================================================
--  デバッグ用のデータ（作り直し版）
--
--  使い方: Supabase ダッシュボード → SQL Editor に全文を貼って Run
--
--  ▼ 注意：このファイルは「全部消してから入れ直す」作りです。
--    アカウントも投稿もカードも、すべて消えます。
--    流したあとは、全員がサインアップからやり直しになります。
--
--  何度 Run しても同じ結果になります。
-- ============================================================


-- ------------------------------------------------------------
--  0. 全部消す
--
--  連鎖（on delete cascade）に任せず、順番に全部書いています。
--  付いていないテーブルが混ざっていると
--  「まだ参照されています」と怒られて途中で止まるためです。
--  実際、card_sends で一度それが起きています。
--
--  順番は「ぶら下がっているもの → 親」です。
-- ------------------------------------------------------------

-- 何かにぶら下がっているもの
delete from recovery_vetoes;
delete from recovery_approvals;
delete from recovery_requests;
delete from recovery_codes;
delete from recovery_contacts;

delete from card_sends;
delete from interactions;
delete from post_reactions;
delete from posts;
delete from memberships;

-- 予定（未来への手紙まわり）。
-- events.created_by には連鎖を付けていないので、
-- これを残したままアカウントを消すと「まだ参照されています」と止まります。
delete from messages;
delete from event_responses;
delete from event_date_options;
delete from events;
delete from time_capsules;

-- 親
delete from communities;
delete from auth.users;   -- profiles も一緒に消えます


-- ------------------------------------------------------------
--  1. ダミーのアカウント（10人）
--
--  profiles.id は auth.users(id) を参照しているので、
--  profiles に直接 insert することはできません。
--  先に auth.users へ入れると、schema.sql の on_auth_user_created が
--  profiles を自動で作ってくれます。
--
--  raw_user_meta_data の full_name / avatar_url が、
--  そのまま profiles の display_name / avatar_url になります。
--
--  ▼ このダミーではログインできません
--    パスワードを入れていないためです。
--    画面で見るためのものと割り切っています。
--    自分のアカウントは /signup から作ってください。
-- ------------------------------------------------------------

-- ▼ 空の文字を入れている列について
--
--   confirmation_token などは、DBの上では「空でもよい」ことになっていますが、
--   Supabase の認証部分は「文字が入っている」前提で読みにいきます。
--   null のままにすると、読み取りに失敗して
--   ログインもサインアップも動かなくなります
--   （"Database error finding users" というエラーになります）。
--
--   空の文字（''）を入れておけば起きません。
insert into auth.users (
  id, instance_id, aud, role, email,
  raw_user_meta_data, raw_app_meta_data,
  created_at, updated_at, email_confirmed_at,
  encrypted_password, confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
)
select
  -- values の中身は「ただの文字」として扱われるので、
  -- 入れ先の型（uuid / jsonb）に合わせて変換します
  v.id::uuid, v.instance_id::uuid, v.aud, v.role, v.email,
  v.meta::jsonb, v.app_meta::jsonb,
  now(), now(), now(),
  -- 9つとも空の文字。encrypted_password が空なので、
  -- このダミーではパスワードでログインできません（見るためだけのものです）
  '', '', '', '', '', '', '', '', ''
from (values
  ('11111111-1111-4111-8111-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kenta@example.com',
   '{"full_name":"齋藤 健介","avatar_url":"https://i.pravatar.cc/200?img=12"}', '{"provider":"email","providers":["email"]}'),
  ('11111111-1111-4111-8111-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'taro@example.com',
   '{"full_name":"山田 太郎","avatar_url":"https://i.pravatar.cc/200?img=13"}', '{"provider":"email","providers":["email"]}'),
  ('11111111-1111-4111-8111-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'misaki@example.com',
   '{"full_name":"佐藤 美咲","avatar_url":"https://i.pravatar.cc/200?img=47"}', '{"provider":"email","providers":["email"]}'),
  ('11111111-1111-4111-8111-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ichiro@example.com',
   '{"full_name":"鈴木 一郎","avatar_url":"https://i.pravatar.cc/200?img=15"}', '{"provider":"email","providers":["email"]}'),
  ('11111111-1111-4111-8111-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'yui@example.com',
   '{"full_name":"高橋 結衣","avatar_url":"https://i.pravatar.cc/200?img=45"}', '{"provider":"email","providers":["email"]}'),
  ('11111111-1111-4111-8111-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ren@example.com',
   '{"full_name":"田中 蓮","avatar_url":"https://i.pravatar.cc/200?img=33"}', '{"provider":"email","providers":["email"]}'),
  ('11111111-1111-4111-8111-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hina@example.com',
   '{"full_name":"中村 陽菜","avatar_url":"https://i.pravatar.cc/200?img=49"}', '{"provider":"email","providers":["email"]}'),
  ('11111111-1111-4111-8111-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daisuke@example.com',
   '{"full_name":"小林 大輔","avatar_url":"https://i.pravatar.cc/200?img=52"}', '{"provider":"email","providers":["email"]}'),
  ('11111111-1111-4111-8111-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sakura@example.com',
   '{"full_name":"松本 さくら","avatar_url":"https://i.pravatar.cc/200?img=32"}', '{"provider":"email","providers":["email"]}'),
  ('11111111-1111-4111-8111-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sota@example.com',
   '{"full_name":"井上 颯太","avatar_url":"https://i.pravatar.cc/200?img=68"}', '{"provider":"email","providers":["email"]}')
) as v(id, instance_id, aud, role, email, meta, app_meta);


-- ------------------------------------------------------------
--  2. 誕生日と、今の気持ち
--
--  profiles は 1. の時点で自動で作られているので、ここでは update です。
--  誕生日は「年」を使わないので、2000年で固定しています
--  （画面は月と日しか見ません）。
--
--  mood は want_to_meet（会いたい！）/ busy（多忙です）/ 空 の3つです。
--  何人かだけに入れて、相関図に印が混ざるようにしています。
-- ------------------------------------------------------------

update profiles set birthday = '2000-06-18', mood = 'want_to_meet' where id = '11111111-1111-4111-8111-000000000001';
update profiles set birthday = '2000-01-05', mood = null           where id = '11111111-1111-4111-8111-000000000002';
update profiles set birthday = '2000-03-22', mood = 'busy'         where id = '11111111-1111-4111-8111-000000000003';
update profiles set birthday = '2000-11-30', mood = null           where id = '11111111-1111-4111-8111-000000000004';
update profiles set birthday = '2000-08-09', mood = 'want_to_meet' where id = '11111111-1111-4111-8111-000000000005';
update profiles set birthday = '2000-05-14', mood = null           where id = '11111111-1111-4111-8111-000000000006';
update profiles set birthday = '2000-09-02', mood = 'busy'         where id = '11111111-1111-4111-8111-000000000007';
update profiles set birthday = '2000-12-25', mood = null           where id = '11111111-1111-4111-8111-000000000008';
update profiles set birthday = '2000-04-01', mood = 'want_to_meet' where id = '11111111-1111-4111-8111-000000000009';
update profiles set birthday = '2000-07-07', mood = null           where id = '11111111-1111-4111-8111-000000000010';


-- ------------------------------------------------------------
--  3. コミュニティ（2つ）
--
--  ▼ 招待コードを控えておいてください
--    自分でサインアップしたあと、このコードで参加します。
--      しばよこハッカソン9班 … YUKARI
--      高校の同級生           … SHIBA22
-- ------------------------------------------------------------

insert into communities (id, name, invite_code, created_by)
values
  ('22222222-2222-4222-8222-000000000001', 'しばよこハッカソン9班', 'YUKARI',
   '11111111-1111-4111-8111-000000000001'),
  ('22222222-2222-4222-8222-000000000002', '高校の同級生', 'SHIBA22',
   '11111111-1111-4111-8111-000000000005');


-- ------------------------------------------------------------
--  4. 参加メンバー
--
--  1つめ … 10人全員
--  2つめ … 4人だけ（コミュニティ切り替えの確認用）
-- ------------------------------------------------------------

-- role は member_role という決められた型なので、
-- case の結果に ::member_role を付けて「この型です」と伝えます。
-- （下の values のほうは、書いた値から自動で判断してくれます）
insert into memberships (user_id, community_id, role)
select id, '22222222-2222-4222-8222-000000000001',
       (case when id = '11111111-1111-4111-8111-000000000001'
             then 'owner' else 'member' end)::member_role
from profiles;

insert into memberships (user_id, community_id, role)
values
  ('11111111-1111-4111-8111-000000000005', '22222222-2222-4222-8222-000000000002', 'owner'),
  ('11111111-1111-4111-8111-000000000006', '22222222-2222-4222-8222-000000000002', 'member'),
  ('11111111-1111-4111-8111-000000000007', '22222222-2222-4222-8222-000000000002', 'member'),
  ('11111111-1111-4111-8111-000000000009', '22222222-2222-4222-8222-000000000002', 'member');


-- ------------------------------------------------------------
--  5. ご報告
--
--  全部に写真を付けてあります（写真のない報告は出さない決まりのため）。
--  画像は外部のURLです。http で始まるものは、
--  アプリ側が「保管庫のものではない」と判断してそのまま表示します。
--
--  日付をばらしてあるのは、相関図の「光る人」を作るためです。
--  新しい20件に入っている人だけが光ります。
-- ------------------------------------------------------------

insert into posts (id, author_id, community_id, title, body, image_url, created_at)
values
  ('33333333-3333-4333-8333-000000000001', '11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000001',
   'プロポーズ成功しました', '3年付き合って、ようやく言えました。', 'https://picsum.photos/seed/yukari1/900/1200', now() - interval '2 hours'),

  ('33333333-3333-4333-8333-000000000002', '11111111-1111-4111-8111-000000000003', '22222222-2222-4222-8222-000000000001',
   '転職します', '来月から、ずっと行きたかった会社で働きます。', 'https://picsum.photos/seed/yukari2/900/1200', now() - interval '1 day'),

  ('33333333-3333-4333-8333-000000000003', '11111111-1111-4111-8111-000000000005', '22222222-2222-4222-8222-000000000001',
   '子どもが生まれました', '3200g、元気な女の子です。', 'https://picsum.photos/seed/yukari3/900/1200', now() - interval '3 days'),

  ('33333333-3333-4333-8333-000000000004', '11111111-1111-4111-8111-000000000002', '22222222-2222-4222-8222-000000000001',
   '引っ越しました', '海の近くです。遊びに来てください。', 'https://picsum.photos/seed/yukari4/900/1200', now() - interval '6 days'),

  ('33333333-3333-4333-8333-000000000005', '11111111-1111-4111-8111-000000000009', '22222222-2222-4222-8222-000000000001',
   '資格に受かりました', '3回目でやっとです。', 'https://picsum.photos/seed/yukari5/900/1200', now() - interval '12 days'),

  ('33333333-3333-4333-8333-000000000006', '11111111-1111-4111-8111-000000000007', '22222222-2222-4222-8222-000000000002',
   '犬を飼いはじめました', '名前はむぎです。', 'https://picsum.photos/seed/yukari6/900/1200', now() - interval '20 days'),

  ('33333333-3333-4333-8333-000000000007', '11111111-1111-4111-8111-000000000006', '22222222-2222-4222-8222-000000000002',
   '店を出しました', '小さなコーヒー屋です。', 'https://picsum.photos/seed/yukari7/900/1200', now() - interval '40 days');


-- ------------------------------------------------------------
--  6. 手書きのお祝い
--
--  報告への反応です。重なった紙の見た目を確認するために、
--  1つの報告に3件つけてあります。
--  drawing_url は保管庫の場所を入れるところですが、
--  ダミーなので外部のURLを入れています。
-- ------------------------------------------------------------

-- community_id も必要です（どのコミュニティでの反応か）。
-- 報告と同じコミュニティになるので、posts から引いてきます。
-- 手で書き写すと、食い違ったときに誰にも見えない反応ができあがります。
insert into post_reactions (post_id, from_user, community_id, drawing_url)
select v.post_id, v.from_user, p.community_id, v.drawing_url
from (
  values
    ('33333333-3333-4333-8333-000000000001'::uuid, '11111111-1111-4111-8111-000000000002'::uuid, 'https://picsum.photos/seed/draw1/600/800'),
    ('33333333-3333-4333-8333-000000000001'::uuid, '11111111-1111-4111-8111-000000000005'::uuid, 'https://picsum.photos/seed/draw2/600/800'),
    ('33333333-3333-4333-8333-000000000001'::uuid, '11111111-1111-4111-8111-000000000007'::uuid, 'https://picsum.photos/seed/draw3/600/800'),
    ('33333333-3333-4333-8333-000000000002'::uuid, '11111111-1111-4111-8111-000000000001'::uuid, 'https://picsum.photos/seed/draw4/600/800')
) as v(post_id, from_user, drawing_url)
join posts p on p.id = v.post_id;


-- ------------------------------------------------------------
--  7. カードの背景
--
--  ※ 画面側は lib/cardBackground.ts の絵を使うので、
--    ここは「送ったカードの記録」を残すためだけに必要な行です。
--    on conflict do update にしてあるので、何度流しても平気です。
-- ------------------------------------------------------------

insert into card_templates (id, kind, name, image_url, created_by)
values
  ('44444444-4444-4444-8444-000000000001', 'newyear',  '年賀状',           '', null),
  ('44444444-4444-4444-8444-000000000011', 'summer',   '暑中見舞い',       '', null),
  ('44444444-4444-4444-8444-000000000021', 'birthday', 'バースデーカード', '', null),
  ('44444444-4444-4444-8444-000000000031', 'custom',   'その他',           '', null)
on conflict (id) do update
  set kind = excluded.kind,
      name = excluded.name;
