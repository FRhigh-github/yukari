-- ============================================================
--  ゆかり / データベースの設計図（土台）
--
--  00_reset.sql でまっさらにしたあと、これを1回だけ流します。
--  そのあと 02_seed.sql を流すと、確認用・発表用のデータが入ります。
--
--  中身の順番（前のものを後ろが使うので、この順で作ります）
--    1. 決まった選択肢（enum）
--    2. テーブル（つながり・チェックも一緒に書きます）
--    3. 索引（探すときの目次）
--    4. 関数
--    5. トリガー（何かが起きたときに自動で動くもの）
--    6. ビュー
--    7. 許可（RLS）…… 誰に何を見せるか。このアプリの本体です
--    8. 関数を呼べる人
--    9. 保管庫（Storage）のバケットと許可
--   10. リアルタイム（チャット）
--   11. 最初から入れておくデータ（カードの種類）
--
--  ▼ 関数の中で if を使っていません
--    Supabase の SQL Editor は、関数の中に if ... then があると、そこで文を切ってしまい、
--    「unterminated dollar-quoted string」で止まることがありました。
--    条件は where に書いて、「条件に合ったときだけ書き込む」形にしています。
--
--  ▼ 削除したときの動き（on delete）の決め方
--    cascade  = 親が消えたら一緒に消える（その人の投稿・参加など、持ち主がいないと意味が無いもの）
--    set null = 親が消えても残し、欄だけ空にする（コミュニティの作成者など、残っていてほしいもの）
--    何も書かない = 親を消せないようにする（カードの種類など、消えては困るもの）
-- ============================================================


-- ============================================================
--  1. 決まった選択肢（enum）
--     ここに無い値を入れようとすると、DB が受け付けません。
-- ============================================================

-- 日程調整の答え（〇 / △ / ×）
create type public.attendance as enum ('yes', 'maybe', 'no');

-- カードの背景の種類。画面の CARD_KINDS（components/CardTemplate.tsx）とそろえます。
-- 前は4種類しかなく、画面にある「結婚祝い・出産祝い・ありがとう」を選ぶと送れませんでした
create type public.card_kind as enum (
  'newyear', 'summer', 'birthday', 'wedding', 'baby', 'thanks', 'custom'
);

-- 「最後に話した日」を記録するときの、きっかけの種類
--   card = カードを送った / reaction = ご報告にお祝いを描いた / comment = チャットで話した
create type public.interaction_kind as enum ('card', 'reaction', 'comment');

create type public.member_role as enum ('owner', 'member');

-- 思い出ログインの申請の状態
create type public.recovery_status as enum ('pending', 'approved', 'rejected', 'expired');


-- ============================================================
--  2. テーブル
--     作ったらすぐに RLS を入れます。
--     RLS を入れたテーブルは、7. の許可で認めた行しか見えません
--     （許可が1つも無ければ、誰も読めない・書けない）。
-- ============================================================

-- ------------------------------------------------------------
--  プロフィール。アカウント（auth.users）1つにつき1行。
--  アカウントができると、5. のトリガーが自動で作ります
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '名前未設定'
    check (char_length(trim(display_name)) between 1 and 40),
  birthday date,
  avatar_url text,
  -- 今の気持ち。want_to_meet = 会いたい！ / busy = 多忙です / null = なし
  mood text check (mood in ('want_to_meet', 'busy')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ------------------------------------------------------------
--  コミュニティ（大切な人たちの輪）
-- ------------------------------------------------------------
create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  invite_code text not null unique,
  -- 作った人が退会しても、コミュニティは残します
  created_by uuid references public.profiles (id) on delete set null,
  -- アイコン。null のときは、名前の1文字目を出します
  icon_url text,
  created_at timestamptz not null default now()
);
alter table public.communities enable row level security;

-- ------------------------------------------------------------
--  誰がどのコミュニティに入っているか
-- ------------------------------------------------------------
create table public.memberships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (user_id, community_id)
);
alter table public.memberships enable row level security;

-- ------------------------------------------------------------
--  ご報告（人生の節目の投稿）
-- ------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 100),
  body text,
  -- 保管庫（posts バケット）の場所。http で始まるものと / で始まるものは、
  -- ダミーデータ用の画像のURLとして、そのまま表示します（lib/signedUrls.ts）
  image_url text not null,
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;

-- ------------------------------------------------------------
--  ご報告への手書きのお祝い
--  community_id は posts から引けますが、あえて持たせています。
--  許可（RLS）で「このコミュニティの人か」を、表を1つ見るだけで確かめられるためです。
--  食い違わないように、7. の許可で「投稿と同じコミュニティか」を確かめています
-- ------------------------------------------------------------
create table public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  from_user uuid not null references public.profiles (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  -- 保管庫（drawings バケット）の場所
  drawing_url text not null,
  created_at timestamptz not null default now()
);
alter table public.post_reactions enable row level security;

-- ------------------------------------------------------------
--  カードの背景の種類（最初から入れておくデータ。11. を参照）
--  絵そのものは画面側（lib/cardBackground.ts）が描くので、ここは名前だけです
-- ------------------------------------------------------------
create table public.card_templates (
  id uuid primary key default gen_random_uuid(),
  kind public.card_kind not null unique,
  name text not null,
  created_at timestamptz not null default now()
);
alter table public.card_templates enable row level security;

-- ------------------------------------------------------------
--  送ったメッセージカード
-- ------------------------------------------------------------
create table public.card_sends (
  id uuid primary key default gen_random_uuid(),
  -- 種類は消えては困るので、連鎖を付けません（使われている種類は消せません）
  template_id uuid not null references public.card_templates (id),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  -- 保管庫（cards バケット）の場所。カードを1枚の絵にしたもの
  drawing_url text,
  -- カードに置いた文字や写真の並び（作り直すときのための記録）
  drawing_data jsonb,
  sent_at timestamptz not null default now(),
  check (from_user <> to_user)
);
alter table public.card_sends enable row level security;

-- ------------------------------------------------------------
--  未来への手紙（タイムカプセル）
--  open_at（開封日）より前は、書いた本人にしか返しません（7. の許可）。
--  画面側では何も隠していません。DB が返さないので、見えようがありません
-- ------------------------------------------------------------
create table public.time_capsules (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  -- 宛先。null = コミュニティ全員へ
  to_user uuid references public.profiles (id) on delete cascade,
  body text,
  -- 保管庫（drawings バケット）の場所。手紙の紙を1枚の絵にしたもの
  image_url text,
  sealed_at timestamptz not null default now(),
  open_at timestamptz not null,
  check (open_at > sealed_at)
);
alter table public.time_capsules enable row level security;

-- ------------------------------------------------------------
--  手紙に付けたイベント（日程調整）
-- ------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  -- 1通の手紙に、イベントは1つまで
  capsule_id uuid not null unique references public.time_capsules (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  -- 決まった日（候補日の1つ）。決まっていなければ null。
  -- 前はこの列がファイルに無く、「日程を決める」が本番の DB 次第で失敗していました
  confirmed_option_id uuid,
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;

-- イベントの候補日
create table public.event_date_options (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  event_date date not null,
  created_at timestamptz not null default now(),
  -- 同じイベントに、同じ日を2回入れられないようにします
  unique (event_id, event_date)
);
alter table public.event_date_options enable row level security;

-- 「決まった日」のつながりは、候補日の表を作ったあとでないと付けられません
-- （events と event_date_options がお互いを指しているため）。
-- 候補日が消えたら「未決定」に戻します
alter table public.events
  add constraint events_confirmed_option_id_fkey
  foreign key (confirmed_option_id) references public.event_date_options (id) on delete set null;

-- 候補日ごとの出欠の答え
create table public.event_responses (
  option_id uuid not null references public.event_date_options (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  answer public.attendance,
  comment text not null default '',
  responded_at timestamptz not null default now(),
  primary key (option_id, user_id)
);
alter table public.event_responses enable row level security;

-- ------------------------------------------------------------
--  イベントのチャット
--  前は、つながり（外部キー）も許可も無く、user_id の初期値がでたらめな id でした
-- ------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  -- 送った人。書かなければ、ログインしている本人になります
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;

-- ------------------------------------------------------------
--  やりとりの記録（「最後に話したのは何年前」の元）
--  カード・お祝い・チャットを送ると、5. のトリガーが自動で1行ずつ足します。
--  画面から直接は書けません（うその記録を作れないようにするため）
-- ------------------------------------------------------------
create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  kind public.interaction_kind not null,
  occurred_at timestamptz not null default now(),
  check (user_a <> user_b)
);
alter table public.interactions enable row level security;

-- ------------------------------------------------------------
--  思い出ログイン
--  ① 仲間が「復旧を手伝うコード」を発行（recovery_codes）
--  ② 本人が3つ入れると申請が立つ（recovery_requests。サーバーだけが書きます）
--  ③ 24時間、コミュニティの誰でも止められる（recovery_vetoes）
-- ------------------------------------------------------------
create table public.recovery_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  target_user uuid not null references public.profiles (id) on delete cascade,
  issued_by uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  used boolean not null default false,
  created_at timestamptz not null default now(),
  -- 1人が同じ相手に出せるコードは1つまで
  unique (target_user, issued_by),
  -- 自分で自分のコードは出せません（3人ぶんの1つを自分で埋められてしまうため）
  check (target_user <> issued_by)
);
alter table public.recovery_codes enable row level security;

create table public.recovery_requests (
  id uuid primary key default gen_random_uuid(),
  target_user uuid not null references public.profiles (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  status public.recovery_status not null default 'pending',
  requested_at timestamptz not null default now()
);
alter table public.recovery_requests enable row level security;

create table public.recovery_vetoes (
  request_id uuid not null references public.recovery_requests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);
alter table public.recovery_vetoes enable row level security;


-- ============================================================
--  3. 索引（探すときの目次）
--     よく使う「絞り込み + 並べ替え」の組み合わせに付けます。
--     主キーと unique には自動で付くので、ここには書いていません
-- ============================================================

create index memberships_community_id_idx on public.memberships (community_id);

-- ホームの「最近のご報告」と、人ごとのご報告の一覧
create index posts_community_id_created_at_idx on public.posts (community_id, created_at desc);
create index posts_author_id_created_at_idx on public.posts (author_id, created_at desc);

create index post_reactions_post_id_created_at_idx on public.post_reactions (post_id, created_at desc);

-- ふみばこの「届いた」「送った」
create index card_sends_to_user_sent_at_idx on public.card_sends (to_user, sent_at desc);
create index card_sends_from_user_sent_at_idx on public.card_sends (from_user, sent_at desc);

-- 手紙。「開封日を過ぎたもの」と「自分が書いたもの」
create index time_capsules_community_id_open_at_idx on public.time_capsules (community_id, open_at);
create index time_capsules_author_id_idx on public.time_capsules (author_id);

create index events_community_id_idx on public.events (community_id);

-- チャットを古い順に出すため
create index messages_event_id_created_at_idx on public.messages (event_id, created_at);

-- 「最後に話した日」を、相手ごとに新しい順で引くため
create index interactions_user_a_occurred_at_idx on public.interactions (user_a, occurred_at desc);
create index interactions_user_b_occurred_at_idx on public.interactions (user_b, occurred_at desc);

create index recovery_codes_target_user_idx on public.recovery_codes (target_user);
create index recovery_requests_community_id_status_idx on public.recovery_requests (community_id, status);


-- ============================================================
--  4. 関数
--
--  security definer = 呼んだ人ではなく、この関数を作った人の権限で動く、という指定。
--  RLS を通り抜けられるので、中で自分で条件を確かめています。
--  set search_path = 関数の中で使う表を、public のものに固定します
--  （同じ名前の偽物の表を差し込まれないようにするため）。
-- ============================================================

-- ------------------------------------------------------------
--  許可（RLS）の中で使う、小さな確かめ役
-- ------------------------------------------------------------

-- 自分がそのコミュニティのメンバーか
-- （memberships の許可に止められずに数えるため、security definer にしています）
create function public.is_member(target_community uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid()
      and community_id = target_community
  );
$$;

-- 自分と相手が、どこか1つでも同じコミュニティにいるか
create function public.shares_community(other uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from memberships mine
    join memberships theirs on theirs.community_id = mine.community_id
    where mine.user_id = auth.uid()
      and theirs.user_id = other
  );
$$;

-- 「デモで入る」で作られたゲストか（メールの最後が @demo.yukari.invalid）。
-- ゲストは、コミュニティを作る・参加する・抜ける・名前やアイコンを変える、ができません。
-- 審査員が同時に触っても、ほかの人の画面が変わらないようにするためです
create function public.is_demo_guest()
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select coalesce(auth.jwt() ->> 'email', '') like '%@demo.yukari.invalid';
$$;

-- 手紙の開封日が来ているか（イベントの許可で使います）
create function public.capsule_is_open(target_capsule uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from time_capsules
    where id = target_capsule
      and open_at <= now()
  );
$$;

-- ------------------------------------------------------------
--  画面から呼ぶ関数（supabase.rpc(...)）
--  communities / memberships には、画面から直接足す許可を出していません。
--  足すのは、この関数を通したときだけです（条件をまとめて確かめられるため）
-- ------------------------------------------------------------

-- コミュニティを作って、自分を owner として入れます。
-- 名前が1〜40文字で、ゲストでないときだけ作ります。合わなければ何もせず null を返します
create function public.create_community(community_name text, code text)
returns uuid
language sql
security definer
set search_path to 'public'
as $$
  with created as (
    insert into communities (name, invite_code, created_by)
    select trim(community_name), upper(trim(code)), auth.uid()
    where auth.uid() is not null
      and not is_demo_guest()
      and char_length(trim(coalesce(community_name, ''))) between 1 and 40
    returning id
  ),
  joined as (
    insert into memberships (user_id, community_id, role)
    select auth.uid(), id, 'owner'::member_role from created
    returning community_id
  )
  select community_id from joined;
$$;

-- 招待コードで参加します。見つかればそのコミュニティの id、見つからなければ null。
-- もう入っているときも、そのコミュニティの id を返します
create function public.join_community(code text)
returns uuid
language sql
security definer
set search_path to 'public'
as $$
  with target as (
    select id from communities
    where invite_code = upper(trim(code))
      and auth.uid() is not null
      and not is_demo_guest()
  ),
  joined as (
    insert into memberships (user_id, community_id)
    select auth.uid(), id from target
    on conflict do nothing
    returning community_id
  )
  select id from target;
$$;

-- 名前を変えます（メンバーなら誰でも）。
-- communities の「書き換え」の許可は出していないので、招待コードなどは変えられません
create function public.rename_community(target_community uuid, new_name text)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  with changed as (
    update communities set name = trim(new_name)
    where id = target_community
      and is_member(target_community)
      and not is_demo_guest()
      and char_length(trim(coalesce(new_name, ''))) between 1 and 40
    returning 1
  )
  select exists (select 1 from changed);
$$;

-- アイコンを変えます（メンバーなら誰でも）。
-- 入れられるのは、このアプリの保管庫の「avatars/communities/<id>.jpg」の URL だけです。
-- 何でも入れられると、よそのサイトの画像（見た人を記録する仕掛けなど）を出させられるためです
create function public.set_community_icon(target_community uuid, url text)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  with changed as (
    update communities set icon_url = url
    where id = target_community
      and is_member(target_community)
      and not is_demo_guest()
      -- ~ は「この形に合っているか」を調べる記号（正規表現）。
      -- 最後の ?t=数字 は、画像を差し替えたときに古い絵が出ないようにする目印です
      and url ~ (
        '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/communities/'
        || target_community::text || '\.jpg(\?t=[0-9]+)?$'
      )
    returning 1
  )
  select exists (select 1 from changed);
$$;

-- ------------------------------------------------------------
--  思い出ログインの判定（サーバーの service_role だけが使います）
--  申請から24時間たっていて、誰も止めていなければ true
-- ------------------------------------------------------------
create function public.recovery_is_unlocked(request uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from recovery_requests r
    where r.id = request
      and r.status = 'pending'
      and r.requested_at + interval '24 hours' <= now()
      and not exists (
        select 1 from recovery_vetoes v where v.request_id = r.id
      )
  );
$$;

-- ------------------------------------------------------------
--  トリガーから呼ぶ関数
-- ------------------------------------------------------------

-- アカウントができたら、プロフィールを作ります。
-- Google で入った人は、Google の名前とアイコンをそのまま使います（40文字で切ります）
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
        '名前未設定'
      ),
      40
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

-- 誰か1人でも「止める」を押したら、申請を止めます
create function public.reject_recovery_request()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update recovery_requests
    set status = 'rejected'
    where id = new.request_id
      and status = 'pending';
  return new;
end;
$$;

-- カードを送ったら「やりとりした」と記録します
create function public.record_card_interaction()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into interactions (user_a, user_b, kind, occurred_at)
  select new.from_user, new.to_user, 'card', new.sent_at
  where new.from_user <> new.to_user;
  return new;
end;
$$;

-- ご報告にお祝いを描いたら、投稿した人と「やりとりした」と記録します
-- （自分の投稿に描いたときは記録しません）
create function public.record_reaction_interaction()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into interactions (user_a, user_b, kind, occurred_at)
  select new.from_user, p.author_id, 'reaction', new.created_at
  from posts p
  where p.id = new.post_id
    and p.author_id <> new.from_user;
  return new;
end;
$$;

-- イベントのチャットで話したら、イベントを企画した人と「やりとりした」と記録します
create function public.record_message_interaction()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into interactions (user_a, user_b, kind, occurred_at)
  select new.user_id, e.created_by, 'comment', new.created_at
  from events e
  where e.id = new.event_id
    and e.created_by <> new.user_id;
  return new;
end;
$$;


-- ============================================================
--  5. トリガー（何かが起きたときに自動で動くもの）
-- ============================================================

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_recovery_veto
  after insert on public.recovery_vetoes
  for each row execute function public.reject_recovery_request();

create trigger on_card_sent
  after insert on public.card_sends
  for each row execute function public.record_card_interaction();

create trigger on_reaction_sent
  after insert on public.post_reactions
  for each row execute function public.record_reaction_interaction();

create trigger on_message_sent
  after insert on public.messages
  for each row execute function public.record_message_interaction();


-- ============================================================
--  6. ビュー（別の表から作った見え方）
-- ============================================================

-- ▼ 相手ごとの「最後にやりとりした日時」
--   interactions は「A → B」の向きで入っているので、向きをそろえてから数えます。
--   me = 自分 / partner = 相手 / last_at = 最後にやりとりした日時
--
-- ▼ security_invoker = true が大切です
--   付けないと、ビューは「作った人（管理者）」の権限で動き、RLS を素通りして
--   全員分のやりとりが誰からでも読めてしまいます。
--   付けると、見ている人の権限で動くので、自分のぶんしか返りません
create view public.last_contacts
with (security_invoker = true)
as
  select me, partner, max(occurred_at) as last_at
  from (
    select user_a as me, user_b as partner, occurred_at from public.interactions
    union all
    select user_b as me, user_a as partner, occurred_at from public.interactions
  ) as both_ways
  group by me, partner;


-- ============================================================
--  7. 許可（RLS）……誰に何を見せるか
--
--  to authenticated = ログインしている人だけに向けた許可です。
--  ログインしていない人（anon）には、どのテーブルも見せません。
--  書いていない操作（たとえば communities の delete）は、誰にもできません。
-- ============================================================

-- ------------------------------------------------------------
--  プロフィール
--  読める：自分と、同じコミュニティにいる人だけ
-- ------------------------------------------------------------
create policy "profiles readable"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or shares_community(id));

create policy "profiles self insert"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles self update"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ------------------------------------------------------------
--  コミュニティ
--  読める：メンバーだけ。
--  作る・名前やアイコンを変えるは、4. の関数を通したときだけです
-- ------------------------------------------------------------
create policy "communities for members"
  on public.communities for select
  to authenticated
  using (is_member(id));

-- ------------------------------------------------------------
--  参加
--  読める：自分の参加と、自分がいるコミュニティの参加。
--  抜ける：自分の分だけ。ゲストは抜けられません（抜けると、どこにも戻れなくなるため）
-- ------------------------------------------------------------
create policy "memberships visible"
  on public.memberships for select
  to authenticated
  using (user_id = auth.uid() or is_member(community_id));

create policy "memberships leave"
  on public.memberships for delete
  to authenticated
  using (user_id = auth.uid() and not is_demo_guest());

-- ------------------------------------------------------------
--  ご報告
-- ------------------------------------------------------------
create policy "posts for members"
  on public.posts for select
  to authenticated
  using (is_member(community_id));

create policy "posts insert"
  on public.posts for insert
  to authenticated
  with check (author_id = auth.uid() and is_member(community_id));

-- 書き換えたあとも「自分の投稿で、自分が入っているコミュニティ」でなければいけません
-- （入っていないコミュニティへ投稿を移せないようにするため）
create policy "posts update own"
  on public.posts for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and is_member(community_id));

create policy "posts delete own"
  on public.posts for delete
  to authenticated
  using (author_id = auth.uid());

-- ------------------------------------------------------------
--  お祝い
-- ------------------------------------------------------------
create policy "reactions for members"
  on public.post_reactions for select
  to authenticated
  using (is_member(community_id));

-- お祝いを付ける投稿が、本当にそのコミュニティのものかも確かめます
create policy "reactions insert"
  on public.post_reactions for insert
  to authenticated
  with check (
    from_user = auth.uid()
    and is_member(community_id)
    and exists (
      select 1 from posts p
      where p.id = post_reactions.post_id
        and p.community_id = post_reactions.community_id
    )
  );

create policy "reactions delete own"
  on public.post_reactions for delete
  to authenticated
  using (from_user = auth.uid());

-- ------------------------------------------------------------
--  カード
-- ------------------------------------------------------------
-- 種類の一覧は、ログインしている人なら誰でも読めます（書き換えは誰もできません）
create policy "templates readable"
  on public.card_templates for select
  to authenticated
  using (true);

-- 読める：送った人と、受け取った人だけ
create policy "cards visible to both"
  on public.card_sends for select
  to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

-- 送れる：自分が入っているコミュニティの、ほかのメンバーにだけ
create policy "cards insert"
  on public.card_sends for insert
  to authenticated
  with check (
    from_user = auth.uid()
    and is_member(community_id)
    and exists (
      select 1 from memberships m
      where m.user_id = card_sends.to_user
        and m.community_id = card_sends.community_id
    )
  );

-- ------------------------------------------------------------
--  未来への手紙
--  読める：書いた本人はいつでも。
--          それ以外は、同じコミュニティで、開封日を過ぎていて、宛先が「全員」か「自分」のものだけ
-- ------------------------------------------------------------
create policy "capsules readable"
  on public.time_capsules for select
  to authenticated
  using (
    author_id = auth.uid()
    or (
      is_member(community_id)
      and open_at <= now()
      and (to_user is null or to_user = auth.uid())
    )
  );

create policy "capsules insert"
  on public.time_capsules for insert
  to authenticated
  with check (author_id = auth.uid() and is_member(community_id));

-- ------------------------------------------------------------
--  イベント
--  読める：同じコミュニティの人で、手紙が開いたあと。作った人はいつでも
-- ------------------------------------------------------------
create policy "events readable"
  on public.events for select
  to authenticated
  using (
    is_member(community_id)
    and (capsule_is_open(capsule_id) or created_by = auth.uid())
  );

-- 作れる：自分が書いた手紙に、その手紙と同じコミュニティで
create policy "events insert"
  on public.events for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and is_member(community_id)
    and exists (
      select 1 from time_capsules c
      where c.id = events.capsule_id
        and c.author_id = auth.uid()
        and c.community_id = events.community_id
    )
  );

-- 変えられる：作った人だけ。「決まった日」は、そのイベントの候補日だけ
create policy "events update by owner"
  on public.events for update
  to authenticated
  using (created_by = auth.uid())
  with check (
    created_by = auth.uid()
    and (
      confirmed_option_id is null
      or exists (
        select 1 from event_date_options o
        where o.id = events.confirmed_option_id
          and o.event_id = events.id
      )
    )
  );

-- 候補日は「そのイベントが見える人」に見えます。
-- exists の中の events にも上の許可が効くので、見えないイベントの候補日は見えません
create policy "date options readable"
  on public.event_date_options for select
  to authenticated
  using (exists (select 1 from events e where e.id = event_date_options.event_id));

create policy "date options insert"
  on public.event_date_options for insert
  to authenticated
  with check (
    exists (
      select 1 from events e
      where e.id = event_date_options.event_id
        and e.created_by = auth.uid()
        and e.community_id = event_date_options.community_id
    )
  );

create policy "date options delete by event owner"
  on public.event_date_options for delete
  to authenticated
  using (
    exists (
      select 1 from events e
      where e.id = event_date_options.event_id
        and e.created_by = auth.uid()
    )
  );

-- 出欠の答え。「その候補日が見えるか」で、メンバーかどうかを確かめます
create policy "responses readable"
  on public.event_responses for select
  to authenticated
  using (exists (select 1 from event_date_options o where o.id = event_responses.option_id));

create policy "responses insert own"
  on public.event_responses for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from event_date_options o where o.id = event_responses.option_id)
  );

create policy "responses update own"
  on public.event_responses for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from event_date_options o where o.id = event_responses.option_id)
  );

create policy "responses delete own"
  on public.event_responses for delete
  to authenticated
  using (user_id = auth.uid());

-- ------------------------------------------------------------
--  チャット
--  読める・書ける：そのイベントが見える人（＝同じコミュニティで、手紙が開いたあと）
-- ------------------------------------------------------------
create policy "messages readable"
  on public.messages for select
  to authenticated
  using (exists (select 1 from events e where e.id = messages.event_id));

create policy "messages insert own"
  on public.messages for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from events e where e.id = messages.event_id)
  );

-- ------------------------------------------------------------
--  やりとりの記録
--  読める：自分が関わった分だけ。書くのはトリガーだけ（画面からは書けません）
-- ------------------------------------------------------------
create policy "interactions visible"
  on public.interactions for select
  to authenticated
  using (user_a = auth.uid() or user_b = auth.uid());

-- ------------------------------------------------------------
--  思い出ログイン
-- ------------------------------------------------------------
-- 発行できる：同じコミュニティにいる、自分以外の人のぶんだけ
create policy "recovery codes issue"
  on public.recovery_codes for insert
  to authenticated
  with check (
    issued_by = auth.uid()
    and target_user <> auth.uid()
    and shares_community(target_user)
  );

create policy "recovery codes read own"
  on public.recovery_codes for select
  to authenticated
  using (issued_by = auth.uid());

create policy "recovery codes delete own"
  on public.recovery_codes for delete
  to authenticated
  using (issued_by = auth.uid());

-- 申請は、そのコミュニティの人に見えます（誰でも止められるように）。
-- 書くのはサーバー（service_role）だけです
create policy "recovery requests for members"
  on public.recovery_requests for select
  to authenticated
  using (is_member(community_id));

create policy "recovery vetoes for members"
  on public.recovery_vetoes for select
  to authenticated
  using (
    exists (
      select 1 from recovery_requests r
      where r.id = recovery_vetoes.request_id
        and is_member(r.community_id)
    )
  );

create policy "recovery vetoes insert"
  on public.recovery_vetoes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from recovery_requests r
      where r.id = recovery_vetoes.request_id
        and r.status = 'pending'
        and is_member(r.community_id)
    )
  );


-- ============================================================
--  8. 関数を呼べる人
--     Supabase は、作った関数を最初は誰でも（ログインしていない人も）呼べる状態にします。
--     必要な人だけに絞ります
-- ============================================================

-- 画面から呼ぶ関数と、許可の中で使う関数：ログインしている人だけ
revoke execute on function
  public.create_community(text, text),
  public.join_community(text),
  public.rename_community(uuid, text),
  public.set_community_icon(uuid, text),
  public.is_member(uuid),
  public.shares_community(uuid),
  public.is_demo_guest(),
  public.capsule_is_open(uuid)
from public, anon;

grant execute on function
  public.create_community(text, text),
  public.join_community(text),
  public.rename_community(uuid, text),
  public.set_community_icon(uuid, text),
  public.is_member(uuid),
  public.shares_community(uuid),
  public.is_demo_guest(),
  public.capsule_is_open(uuid)
to authenticated, service_role;

-- 思い出ログインの判定：サーバー（service_role）だけ
revoke execute on function public.recovery_is_unlocked(uuid) from public, anon, authenticated;
grant execute on function public.recovery_is_unlocked(uuid) to service_role;


-- ============================================================
--  9. 保管庫（Storage）
-- ============================================================

-- ▼ バケット（置き場所）を作ります。もうあれば、公開かどうかだけ合わせます
--   avatars  = 公開。プロフィールとコミュニティのアイコン（相関図で全員分を出すため）
--   posts    = 非公開。ご報告の写真
--   drawings = 非公開。手書きのお祝いと、未来への手紙の紙
--   cards    = 非公開。メッセージカード
--   非公開のものは、サーバーが期限付きURLを作って見せます（lib/signedUrls.ts）
--
-- ▼ 権限が無いときは、止まらずに先へ進みます
--   プロジェクトによっては、SQL からバケットを作る権限が postgres に無く、
--   「permission denied for table buckets」で止まります（ローカルで試したときに実際に起きました）。
--   このファイルは途中で止まると何も入らないので、ここだけは失敗しても先へ進むようにしています。
--   そのときは、流したあとに「NOTICE: バケットを…」と出るので、README.md の手順で
--   ダッシュボードから作ってください（すでにあるなら、何もしなくて大丈夫です）。
--   exception = begin〜end の間で起きたエラーを受け止める書き方です
do $$
begin
  insert into storage.buckets (id, name, public)
  values
    ('avatars', 'avatars', true),
    ('posts', 'posts', false),
    ('drawings', 'drawings', false),
    ('cards', 'cards', false)
  on conflict (id) do update set public = excluded.public;
exception
  when insufficient_privilege then
    raise notice 'バケットを SQL から作る権限がありませんでした。supabase/README.md の「保管庫」を見て、ダッシュボードで作ってください';
end $$;

-- ▼ 許可。00_reset.sql で全部消しているので、ここで作るものが全てです。
--   storage.foldername(name)[1] = いちばん上のフォルダ名
--   storage.filename(name)      = フォルダを除いたファイル名

-- プロフィールのアイコン：avatars/<自分の id>.jpg だけ。
-- 上書き（upsert）で上げているので、置く・上書き・読む の3つが要ります
create policy "avatar insert own"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');

create policy "avatar update own"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg')
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');

create policy "avatar read own"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');

-- コミュニティのアイコン：avatars/communities/<コミュニティの id>.jpg。
-- そのコミュニティのメンバーだけ（ゲストは除く）。
-- ▼ id の比べ方について
--   ファイル名を uuid に変換して比べると、uuid でない名前のときにエラーで止まります。
--   文字のまま比べれば、合わないだけで済みます
create policy "community icon insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'communities'
    and not public.is_demo_guest()
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.community_id::text = replace(storage.filename(name), '.jpg', '')
    )
  );

create policy "community icon update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'communities'
    and not public.is_demo_guest()
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.community_id::text = replace(storage.filename(name), '.jpg', '')
    )
  );

create policy "community icon read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'communities'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.community_id::text = replace(storage.filename(name), '.jpg', '')
    )
  );

-- 写真・お祝い・手紙・カード：「<自分の id>/<ファイル名>」に置く、自分が置いたものを読む、だけ。
-- 他人のものを読む・上書きする・消すは、誰にも許しません
-- （見せるときは、サーバーが RLS を通して取った場所にだけ期限付きURLを作ります）
create policy "photos upload own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('posts', 'drawings', 'cards')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "photos read own folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('posts', 'drawings', 'cards')
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================
--  10. リアルタイム（チャットの新しい発言をすぐ届ける）
--     supabase_realtime という配信の一覧に、messages を足します。
--     届くのは 7. の許可で「読める」人にだけです
-- ============================================================
--   権限が無くても止まらないようにしています（チャットは、開き直せば新しい発言が出ます）
do $$
declare
  p record;
begin
  -- for は「あれば1回だけ回る」使い方です（if を使わずに書くため）
  for p in select pubname from pg_publication where pubname = 'supabase_realtime'
  loop
    execute 'alter publication supabase_realtime add table public.messages';
  end loop;
exception
  when insufficient_privilege then
    raise notice 'リアルタイムの設定ができませんでした。ダッシュボードの Database → Publications で supabase_realtime に messages を足してください';
end $$;


-- ============================================================
--  11. 最初から入れておくデータ
-- ============================================================

-- カードの種類。card_sends が必ず1つを指すので、無いとカードを送れません
insert into public.card_templates (id, kind, name)
values
  ('55555555-5555-4555-8555-000000000001', 'newyear', '年賀状'),
  ('55555555-5555-4555-8555-000000000002', 'summer', '暑中見舞い'),
  ('55555555-5555-4555-8555-000000000003', 'birthday', 'バースデーカード'),
  ('55555555-5555-4555-8555-000000000004', 'wedding', '結婚祝い'),
  ('55555555-5555-4555-8555-000000000005', 'baby', '出産祝い'),
  ('55555555-5555-4555-8555-000000000006', 'thanks', 'ありがとう'),
  ('55555555-5555-4555-8555-000000000007', 'custom', 'その他');


-- ============================================================
--  確認：流したあとの許可の一覧
--  最後にこれが表として出ます。using (true) が「templates readable」以外に無いことを見てください
-- ============================================================
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, cmd, policyname;
