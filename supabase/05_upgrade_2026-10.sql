-- ============================================================
--  ゆかり / 本番の DB を最新の形にする（2026年10月の変更をまとめたもの）
--
--  supabase/migrations/ の20個のファイルを、流す順につなげたものです。
--  本番の SQL Editor に、このファイルの中身をまるごと貼って、1回だけ Run します。
--
--  ▼ 全部入るか、何も入らないか
--    いちばん上の begin と、いちばん下の commit で包んでいます。
--    途中でエラーになったら、それまでの分も入らずに元のままです。
--    エラーの文を読んで直してから、もう一度まるごと流してください。
--
--  ▼ 流すタイミング
--    アプリを新しい版にデプロイするのと、同じタイミングで流してください。
--    （コミュニティを作る関数の形が変わったので、ずれるとコミュニティを作れなくなります）
--
--  ▼ このあとに
--    ダミーのデータを片づけるときは、続けて 04_remove_dummy_data.sql を流します（別のファイルです）。
--
--  ▼ 2回流さないでください
--    すでに流したあとにもう一度流すと、「もうある」というエラーで止まります（何も変わりません）。
-- ============================================================

begin;

-- ############################################################
--  2026-10-04_01_own_file_paths.sql
-- ############################################################

-- ============================================================
--  写真の場所に「自分のフォルダのものか」の確かめを足す
--
--  前は、ご報告・お祝い・カード・手紙を書くとき、写真の場所（image_url など）に
--  何を書いても通っていました。他人の写真の場所を自分の投稿に書くと、
--  サーバーがその写真の期限付きURLを作ってしまう穴がありました。
--  01_schema.sql の is_own_file と同じものです。
-- ============================================================

create function public.is_own_file(path text)
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select coalesce(
    path ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.(jpg|png)$'),
    false
  );
$$;

revoke execute on function public.is_own_file(text) from public, anon;
grant execute on function public.is_own_file(text) to authenticated, service_role;

drop policy "posts insert" on public.posts;
create policy "posts insert"
  on public.posts for insert
  to authenticated
  with check (author_id = auth.uid() and is_member(community_id) and is_own_file(image_url));

drop policy "posts update own" on public.posts;
create policy "posts update own"
  on public.posts for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and is_member(community_id) and is_own_file(image_url));

drop policy "reactions insert" on public.post_reactions;
create policy "reactions insert"
  on public.post_reactions for insert
  to authenticated
  with check (
    from_user = auth.uid()
    and is_member(community_id)
    and is_own_file(drawing_url)
    and exists (
      select 1 from posts p
      where p.id = post_reactions.post_id
        and p.community_id = post_reactions.community_id
    )
  );

drop policy "cards insert" on public.card_sends;
create policy "cards insert"
  on public.card_sends for insert
  to authenticated
  with check (
    from_user = auth.uid()
    and is_member(community_id)
    and (drawing_url is null or is_own_file(drawing_url))
    and exists (
      select 1 from memberships m
      where m.user_id = card_sends.to_user
        and m.community_id = card_sends.community_id
    )
  );

drop policy "capsules insert" on public.time_capsules;
create policy "capsules insert"
  on public.time_capsules for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and is_member(community_id)
    and (image_url is null or is_own_file(image_url))
  );

-- ############################################################
--  2026-10-04_02_strong_invite_codes.sql
-- ############################################################

-- ============================================================
--  招待コードを DB の中で、当てられない長さで作る
--
--  前は画面側で16進6文字（約1,600万通り）を作って渡していたので、
--  手当たり次第に試すと、よそのコミュニティに入れてしまうおそれがありました。
--  これからは DB が32種類×10文字（約1,000兆通り）で作ります。
--  すでにあるコミュニティのコードは、そのまま残します（配った招待が使えなくならないように）。
--  01_schema.sql の make_invite_code / create_community と同じものです。
-- ============================================================

create function public.make_invite_code()
returns text
language sql
volatile
set search_path to 'public'
as $$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', get_byte(uuid_send(gen_random_uuid()), 0) % 32 + 1, 1),
    ''
  )
  from generate_series(1, 10);
$$;

revoke execute on function public.make_invite_code() from public, anon, authenticated;
grant execute on function public.make_invite_code() to service_role;

drop function public.create_community(text, text);

create function public.create_community(community_name text)
returns uuid
language sql
security definer
set search_path to 'public'
as $$
  with created as (
    insert into communities (name, invite_code, created_by)
    select trim(community_name), make_invite_code(), auth.uid()
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

revoke execute on function public.create_community(text) from public, anon;
grant execute on function public.create_community(text) to authenticated, service_role;

-- ############################################################
--  2026-10-04_03_random_avatar_names.sql
-- ############################################################

-- ============================================================
--  アイコンのファイル名に、ランダムな id を入れる
--
--  avatars は公開の置き場所なので、URL さえ分かれば誰でも見られます。
--  前は「<ユーザーの id>.jpg」「communities/<コミュニティの id>.jpg」という名前で、
--  id を知っている人なら URL を作れてしまいました。
--  これからは「<id>/<ランダムな id>.jpg」に置き、変えたら前のファイルを消します。
--  01_schema.sql の「9. 保管庫」と set_community_icon と同じものです。
--
--  ▼ 流したあとに
--    前の形のファイルは、持ち主がアイコンを変えたときに消えます。
--    すぐに全部消したいときは、ダッシュボードの Storage → avatars で、
--    フォルダに入っていない「<id>.jpg」と「communities/<id>.jpg」を消してください。
-- ============================================================

drop policy "avatar insert own" on storage.objects;
drop policy "avatar update own" on storage.objects;
drop policy "avatar read own" on storage.objects;
drop policy "community icon insert" on storage.objects;
drop policy "community icon update" on storage.objects;
drop policy "community icon read" on storage.objects;

-- プロフィールのアイコン：avatars/<自分の id>/<ランダムな id>.jpg（lib/avatarFile.ts）。
-- ▼ 名前にランダムな id を入れている理由
--   avatars は公開の置き場所なので、URL さえ分かれば誰でも見られます。
--   前は「<自分の id>.jpg」で、id を知っている人なら URL を作れてしまいました。
-- 置く・読む・消す の3つです（上書きはしないので、書き換えの許可はありません）。
-- 読む・消すは、前の形（<自分の id>.jpg）のファイルも片づけられるように、そちらも認めます
create policy "avatar insert own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and name ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$')
  );

create policy "avatar read own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or name = auth.uid()::text || '.jpg')
  );

create policy "avatar delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or name = auth.uid()::text || '.jpg')
  );

-- コミュニティのアイコン：avatars/communities/<コミュニティの id>/<ランダムな id>.jpg。
-- そのコミュニティのメンバーだけ（ゲストは除く）。
-- ▼ id の比べ方について
--   ファイル名を uuid に変換して比べると、uuid でない名前のときにエラーで止まります。
--   文字のまま比べれば、合わないだけで済みます。
--   coalesce の2つめは、前の形（communities/<コミュニティの id>.jpg）を片づけるためです
create policy "community icon insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and name ~ '^communities/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
    and not public.is_demo_guest()
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.community_id::text = (storage.foldername(name))[2]
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
        and m.community_id::text = coalesce(
          (storage.foldername(name))[2],
          replace(storage.filename(name), '.jpg', '')
        )
    )
  );

create policy "community icon delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'communities'
    and not public.is_demo_guest()
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.community_id::text = coalesce(
          (storage.foldername(name))[2],
          replace(storage.filename(name), '.jpg', '')
        )
    )
  );


create or replace function public.set_community_icon(target_community uuid, url text)
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
      and url ~ (
        '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/communities/'
        || target_community::text || '/[0-9a-f-]{36}\.jpg$'
      )
    returning 1
  )
  select exists (select 1 from changed);
$$;

-- ############################################################
--  2026-10-04_04_allowed_avatar_urls.sql
-- ############################################################

-- ============================================================
--  プロフィールのアイコンに入れられる URL を絞る
--
--  前は profiles.avatar_url に、よそのサイトの URL を何でも入れられました。
--  見た人を記録する画像などを、コミュニティの全員の画面に出させられる穴でした。
--  01_schema.sql の is_allowed_avatar と、profiles の許可と同じものです。
-- ============================================================

create function public.is_allowed_avatar(url text)
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select url is null
    or url ~ (
      '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/'
      || auth.uid()::text || '(/[0-9a-f-]{36})?\.jpg(\?t=[0-9]+)?$'
    )
    or url ~ '^https://lh3\.googleusercontent\.com/[A-Za-z0-9/_=-]+$'
    or url ~ '^/demo/avatars/[a-z0-9-]+\.svg$';
$$;


revoke execute on function public.is_allowed_avatar(text) from public, anon;
grant execute on function public.is_allowed_avatar(text) to authenticated, service_role;

drop policy "profiles self insert" on public.profiles;
create policy "profiles self insert"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid() and is_allowed_avatar(avatar_url));

drop policy "profiles self update" on public.profiles;
create policy "profiles self update"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and is_allowed_avatar(avatar_url));

-- ############################################################
--  2026-10-04_05_recovery_visible_to_all.sql
-- ############################################################

-- ============================================================
--  思い出ログインの申請を、本人と、同じコミュニティにいる全員に見せる
--
--  前は「申請を立てたコミュニティ（入っているうちの1つ）」の人にしか見えず、
--  ほかのコミュニティの人や、本当の持ち主は、乗っ取りに気づいても止められませんでした。
--  01_schema.sql の「思い出ログイン」の許可と同じものです。
-- ============================================================

drop policy "recovery requests for members" on public.recovery_requests;
drop policy "recovery vetoes for members" on public.recovery_vetoes;
drop policy "recovery vetoes insert" on public.recovery_vetoes;

-- 申請は、復旧しようとしている人と、どこか1つでも同じコミュニティにいる人に見えます
-- （誰でも止められるように）。書くのはサーバー（service_role）だけです。
-- ▼ 前は「申請を立てたコミュニティ」の人にしか見えませんでした
--   2つ以上のコミュニティに入っている人の場合、そのうち1つの人にしか知らせが出ず、
--   ほかのコミュニティの人は、乗っ取りに気づいても止められませんでした。
-- ▼ 本人（target_user）にも見せます
--   本当の持ち主がまだログインできているなら、それは乗っ取りです。本人がいちばん早く気づけます
create policy "recovery requests visible"
  on public.recovery_requests for select
  to authenticated
  using (
    target_user = auth.uid()
    or is_member(community_id)
    or shares_community(target_user)
  );

-- 止めた記録は、その申請が見える人に見えます。
-- exists の中の recovery_requests にも上の許可が効くので、見えない申請の分は見えません
create policy "recovery vetoes visible"
  on public.recovery_vetoes for select
  to authenticated
  using (
    exists (select 1 from recovery_requests r where r.id = recovery_vetoes.request_id)
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
    )
  );

-- ############################################################
--  2026-10-04_06_rate_limits.sql
-- ############################################################

-- ============================================================
--  回数制限を入れる
--
--  前は、投稿・お祝い・カード・手紙・チャット・写真のアップロード・招待コードでの参加に
--  回数の制限が無く、プログラムで何万回でもできてしまいました。
--  1時間あたりの回数を数える under_rate_limit を作り、許可（RLS）に足します。
--  思い出ログインの API は、アクセス元ごとに recovery_attempts で数えます（app/api/recovery）。
--  01_schema.sql と同じものです。
-- ============================================================

-- ------------------------------------------------------------
--  回数制限のための記録（under_rate_limit で数えます）
--  join_attempts     … 招待コードで参加しようとした記録（当たり外れに関係なく1回ずつ）
--  recovery_attempts … 思い出ログインのコードを試した記録。まだログインしていない人なので、
--                      アクセス元（IP アドレス）で数えます。サーバー（service_role）だけが書きます
--  どちらも許可を1つも出していないので、画面からは読めません・書けません
-- ------------------------------------------------------------
create table public.join_attempts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempted_at timestamptz not null default now()
);
alter table public.join_attempts enable row level security;

create table public.recovery_attempts (
  ip text not null,
  attempted_at timestamptz not null default now()
);
alter table public.recovery_attempts enable row level security;

-- 回数制限（under_rate_limit）で「この人の、この1時間の分」を数えるため
create index post_reactions_from_user_created_at_idx on public.post_reactions (from_user, created_at desc);
create index messages_user_id_created_at_idx on public.messages (user_id, created_at desc);
create index join_attempts_user_id_attempted_at_idx on public.join_attempts (user_id, attempted_at desc);
create index recovery_attempts_ip_attempted_at_idx on public.recovery_attempts (ip, attempted_at desc);

create function public.under_rate_limit(kind text, max_count integer)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (
    case kind
      when 'posts' then (
        select count(*) from posts
        where author_id = auth.uid() and created_at > now() - interval '1 hour')
      when 'reactions' then (
        select count(*) from post_reactions
        where from_user = auth.uid() and created_at > now() - interval '1 hour')
      when 'cards' then (
        select count(*) from card_sends
        where from_user = auth.uid() and sent_at > now() - interval '1 hour')
      when 'capsules' then (
        select count(*) from time_capsules
        where author_id = auth.uid() and sealed_at > now() - interval '1 hour')
      when 'messages' then (
        select count(*) from messages
        where user_id = auth.uid() and created_at > now() - interval '1 hour')
      when 'joins' then (
        select count(*) from join_attempts
        where user_id = auth.uid() and attempted_at > now() - interval '1 hour')
      -- 保管庫に置いたファイル（自分のフォルダの分。アイコンも含みます）
      when 'uploads' then (
        select count(*) from storage.objects o
        where (storage.foldername(o.name))[1] = auth.uid()::text
          and o.created_at > now() - interval '1 hour')
      -- 知らない種類は、止めておきます（書き間違いで制限が効かなくならないように）
      else max_count
    end
  ) < max_count;
$$;

revoke execute on function public.under_rate_limit(text, integer) from public, anon;
grant execute on function public.under_rate_limit(text, integer) to authenticated, service_role;

create or replace function public.join_community(code text)
returns uuid
language sql
security definer
set search_path to 'public'
as $$
  with attempt as (
    insert into join_attempts (user_id)
    select auth.uid() where auth.uid() is not null
  ),
  cleanup as (
    delete from join_attempts where attempted_at < now() - interval '1 day'
  ),
  target as (
    select id from communities
    where invite_code = upper(trim(code))
      and auth.uid() is not null
      and not is_demo_guest()
      and under_rate_limit('joins', 20)
  ),
  joined as (
    insert into memberships (user_id, community_id)
    select auth.uid(), id from target
    on conflict do nothing
    returning community_id
  )
  select id from target;
$$;

drop policy if exists "posts insert" on public.posts;
create policy "posts insert"
  on public.posts for insert
  to authenticated
  with check (author_id = auth.uid() and is_member(community_id) and is_own_file(image_url) and under_rate_limit('posts', 20));

drop policy if exists "reactions insert" on public.post_reactions;
create policy "reactions insert"
  on public.post_reactions for insert
  to authenticated
  with check (
    from_user = auth.uid()
    and is_member(community_id)
    and is_own_file(drawing_url)
    and under_rate_limit('reactions', 100)
    and exists (
      select 1 from posts p
      where p.id = post_reactions.post_id
        and p.community_id = post_reactions.community_id
    )
  );

drop policy if exists "cards insert" on public.card_sends;
create policy "cards insert"
  on public.card_sends for insert
  to authenticated
  with check (
    from_user = auth.uid()
    and is_member(community_id)
    and (drawing_url is null or is_own_file(drawing_url))
    and under_rate_limit('cards', 50)
    and exists (
      select 1 from memberships m
      where m.user_id = card_sends.to_user
        and m.community_id = card_sends.community_id
    )
  );

drop policy if exists "capsules insert" on public.time_capsules;
create policy "capsules insert"
  on public.time_capsules for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and is_member(community_id)
    and (image_url is null or is_own_file(image_url))
    and under_rate_limit('capsules', 20)
  );

drop policy if exists "messages insert own" on public.messages;
create policy "messages insert own"
  on public.messages for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and under_rate_limit('messages', 300)
    and exists (select 1 from events e where e.id = messages.event_id)
  );

drop policy if exists "avatar insert own" on storage.objects;
create policy "avatar insert own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and under_rate_limit('uploads', 100)
    and name ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$')
  );

drop policy if exists "community icon insert" on storage.objects;
create policy "community icon insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and name ~ '^communities/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
    and not public.is_demo_guest()
    and public.under_rate_limit('uploads', 100)
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.community_id::text = (storage.foldername(name))[2]
    )
  );

drop policy if exists "photos upload own folder" on storage.objects;
create policy "photos upload own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('posts', 'drawings', 'cards')
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.under_rate_limit('uploads', 100)
  );

-- ############################################################
--  2026-10-04_07_bucket_limits.sql
-- ############################################################

-- ============================================================
--  保管庫に置けるファイルの大きさと種類に、上限を付ける
--
--  前は上限が無く、自分のフォルダになら巨大なファイルや HTML・SVG も置けました。
--  01_schema.sql の「9. 保管庫」と同じ値です。
--  権限が無くて失敗したときは NOTICE が出ます。そのときは supabase/README.md の
--  「保管庫」の表のとおりに、ダッシュボードで各バケットの設定を変えてください。
-- ============================================================

do $$
begin
  update storage.buckets set file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'] where id = 'avatars';
  update storage.buckets set file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'] where id = 'posts';
  update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/png'] where id = 'drawings';
  update storage.buckets set file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'] where id = 'cards';
exception
  when insufficient_privilege then
    raise notice 'バケットの設定を SQL から変える権限がありませんでした。supabase/README.md の「保管庫」を見て、ダッシュボードで変えてください';
end $$;

-- ############################################################
--  2026-10-04_08_private_letter_events.sql
-- ############################################################

-- ============================================================
--  宛先が特定の人の手紙では、日程調整とチャットも、その人と書いた人にしか見せない
--
--  前は「手紙の開封日が来ているか」だけを見ていたので、
--  宛先が特定の人の手紙でも、付いている日程調整（イベント名・候補日・出欠）と
--  チャットが、コミュニティの全員に見えていました。
--  01_schema.sql の capsule_is_visible と「events readable」と同じものです。
-- ============================================================

create function public.capsule_is_visible(target_capsule uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from time_capsules
    where id = target_capsule
      and (
        author_id = auth.uid()
        or (open_at <= now() and (to_user is null or to_user = auth.uid()))
      )
  );
$$;

revoke execute on function public.capsule_is_visible(uuid) from public, anon;
grant execute on function public.capsule_is_visible(uuid) to authenticated, service_role;

drop policy if exists "events readable" on public.events;
create policy "events readable"
  on public.events for select
  to authenticated
  using (
    is_member(community_id)
    and (capsule_is_visible(capsule_id) or created_by = auth.uid())
  );

drop function public.capsule_is_open(uuid);

-- ############################################################
--  2026-10-04_09_text_length_limits.sql
-- ############################################################

-- ============================================================
--  長すぎる文字を入れられないようにする
--
--  前は、ご報告の本文・手紙の本文・出欠のひとこと・カードの配置の記録に上限が無く、
--  プログラムから何MBもの文字を入れられました。
--  01_schema.sql の check と同じ上限です。
--
--  not valid = 「これから入れる行」だけを確かめます。
--  すでに入っている行に長いものがあっても、流すのが止まらないようにするためです
-- ============================================================

alter table public.posts
  add constraint posts_body_length check (char_length(body) <= 2000) not valid;
alter table public.time_capsules
  add constraint time_capsules_body_length check (char_length(body) <= 10000) not valid;
alter table public.event_responses
  add constraint event_responses_comment_length check (char_length(comment) <= 200) not valid;
alter table public.card_sends
  add constraint card_sends_drawing_data_size check (pg_column_size(drawing_data) <= 102400) not valid;

-- ############################################################
--  2026-10-04_10_birthday_without_year.sql
-- ############################################################

-- ============================================================
--  誕生日の年を、いつも2000年にそろえる
--
--  画面は月と日だけを聞き、年は2000年と決めて入れています（components/BirthdayPicker.tsx）。
--  この作りになる前に登録した人の分には、本当の生まれ年が入っているかもしれません。
--  生まれ年は人に知られたくない情報なので、2000年に置き換え、これからも2000年しか入らないようにします。
--  （2000年はうるう年なので、2月29日生まれの人もそのまま入ります）
-- ============================================================

update public.profiles
  set birthday = make_date(2000, extract(month from birthday)::int, extract(day from birthday)::int)
  where birthday is not null and extract(year from birthday) <> 2000;

alter table public.profiles
  add constraint profiles_birthday_year check (extract(year from birthday) = 2000);

-- ############################################################
--  2026-10-04_11_remove_demo_guests.sql
-- ############################################################

-- ============================================================
--  「デモで入る」（発表用のゲスト）の仕組みを取り除く
--
--  ゲストは、コミュニティの作成・参加・退出・名前やアイコンの変更ができないように、
--  is_demo_guest() で止めていました。公開に向けてデモの入口を無くしたので、関数ごと消します。
--  残っているゲストのアカウントとダミーのデータは、
--  supabase/04_remove_dummy_data.sql で消してください（こちらは本番の DB にだけ流します）。
--  01_schema.sql と同じものです。
-- ============================================================

create or replace function public.create_community(community_name text)
returns uuid
language sql
security definer
set search_path to 'public'
as $$
  with created as (
    insert into communities (name, invite_code, created_by)
    select trim(community_name), make_invite_code(), auth.uid()
    where auth.uid() is not null
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

create or replace function public.join_community(code text)
returns uuid
language sql
security definer
set search_path to 'public'
as $$
  with attempt as (
    insert into join_attempts (user_id)
    select auth.uid() where auth.uid() is not null
  ),
  cleanup as (
    delete from join_attempts where attempted_at < now() - interval '1 day'
  ),
  target as (
    select id from communities
    where invite_code = upper(trim(code))
      and auth.uid() is not null
      and under_rate_limit('joins', 20)
  ),
  joined as (
    insert into memberships (user_id, community_id)
    select auth.uid(), id from target
    on conflict do nothing
    returning community_id
  )
  select id from target;
$$;

create or replace function public.rename_community(target_community uuid, new_name text)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  with changed as (
    update communities set name = trim(new_name)
    where id = target_community
      and is_member(target_community)
      and char_length(trim(coalesce(new_name, ''))) between 1 and 40
    returning 1
  )
  select exists (select 1 from changed);
$$;

create or replace function public.set_community_icon(target_community uuid, url text)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  with changed as (
    update communities set icon_url = url
    where id = target_community
      and is_member(target_community)
      -- ~ は「この形に合っているか」を調べる記号（正規表現）。
      and url ~ (
        '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/communities/'
        || target_community::text || '/[0-9a-f-]{36}\.jpg$'
      )
    returning 1
  )
  select exists (select 1 from changed);
$$;

drop policy if exists "memberships leave" on public.memberships;
create policy "memberships leave"
  on public.memberships for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "community icon insert" on storage.objects;
create policy "community icon insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and name ~ '^communities/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
    and public.under_rate_limit('uploads', 100)
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.community_id::text = (storage.foldername(name))[2]
    )
  );

drop policy if exists "community icon delete" on storage.objects;
create policy "community icon delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'communities'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.community_id::text = coalesce(
          (storage.foldername(name))[2],
          replace(storage.filename(name), '.jpg', '')
        )
    )
  );

drop function public.is_demo_guest();

-- ############################################################
--  2026-10-04_12_reports_and_blocks.sql
-- ############################################################

-- ============================================================
--  報告・ブロック・メンバーを外す
--
--  ・人を報告できる（report_user）。そのコミュニティの作成者が、設定の画面で読める
--  ・人をブロックできる（blocks）。ブロックした人のご報告・お祝い・カードは自分に見えず、
--    ブロックされた人はカードを送れない
--  ・作成者は、メンバーを外せる（remove_member）。困るご報告を消せる
--  01_schema.sql と同じものです。
-- ============================================================

-- ------------------------------------------------------------
--  報告とブロック
--  reports … 「この人の振る舞いが困る」という報告。報告した人と、
--             そのコミュニティの作成者（owner）だけが読めます。書くのは report_user だけです
--  blocks  … 自分がブロックした人。ブロックした人のご報告・お祝い・カードは、自分には見えません。
--             ブロックされた人は、ブロックした人にカードを送れません。
--             ブロックしたことは、相手には分かりません（自分の分しか読めないため）
-- ------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references public.profiles (id) on delete cascade,
  reported_user uuid not null references public.profiles (id) on delete cascade,
  -- どのコミュニティの作成者に知らせるか。二人が一緒にいるコミュニティごとに1行ずつ入ります
  community_id uuid not null references public.communities (id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  check (reporter <> reported_user)
);
alter table public.reports enable row level security;

create table public.blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.blocks enable row level security;

create index reports_community_id_created_at_idx on public.reports (community_id, created_at desc);
create index reports_reporter_created_at_idx on public.reports (reporter, created_at desc);

create function public.is_owner(target_community uuid)
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
      and role = 'owner'
  );
$$;

create function public.has_blocked(blocker_id uuid, blocked_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from blocks where blocker = blocker_id and blocked = blocked_id
  );
$$;

create or replace function public.under_rate_limit(kind text, max_count integer)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (
    case kind
      when 'posts' then (
        select count(*) from posts
        where author_id = auth.uid() and created_at > now() - interval '1 hour')
      when 'reactions' then (
        select count(*) from post_reactions
        where from_user = auth.uid() and created_at > now() - interval '1 hour')
      when 'cards' then (
        select count(*) from card_sends
        where from_user = auth.uid() and sent_at > now() - interval '1 hour')
      when 'capsules' then (
        select count(*) from time_capsules
        where author_id = auth.uid() and sealed_at > now() - interval '1 hour')
      when 'messages' then (
        select count(*) from messages
        where user_id = auth.uid() and created_at > now() - interval '1 hour')
      when 'reports' then (
        select count(*) from reports
        where reporter = auth.uid() and created_at > now() - interval '1 hour')
      when 'joins' then (
        select count(*) from join_attempts
        where user_id = auth.uid() and attempted_at > now() - interval '1 hour')
      -- 保管庫に置いたファイル（自分のフォルダの分。アイコンも含みます）
      when 'uploads' then (
        select count(*) from storage.objects o
        where (storage.foldername(o.name))[1] = auth.uid()::text
          and o.created_at > now() - interval '1 hour')
      -- 知らない種類は、止めておきます（書き間違いで制限が効かなくならないように）
      else max_count
    end
  ) < max_count;
$$;

create function public.report_user(target_user uuid, reason text)
returns integer
language sql
security definer
set search_path to 'public'
as $$
  with inserted as (
    insert into reports (reporter, reported_user, community_id, reason)
    select auth.uid(), target_user, mine.community_id, trim(reason)
    from memberships mine
    join memberships theirs on theirs.community_id = mine.community_id
    where mine.user_id = auth.uid()
      and theirs.user_id = target_user
      and target_user <> auth.uid()
      and char_length(trim(coalesce(reason, ''))) between 1 and 500
      and under_rate_limit('reports', 10)
    returning 1
  )
  select count(*)::integer from inserted;
$$;

create function public.remove_member(target_community uuid, target_user uuid)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  with removed as (
    delete from memberships
    where community_id = target_community
      and user_id = target_user
      and target_user <> auth.uid()
      and is_owner(target_community)
    returning 1
  )
  select exists (select 1 from removed);
$$;

revoke execute on function
  public.is_owner(uuid), public.has_blocked(uuid, uuid),
  public.report_user(uuid, text), public.remove_member(uuid, uuid)
from public, anon;
grant execute on function
  public.is_owner(uuid), public.has_blocked(uuid, uuid),
  public.report_user(uuid, text), public.remove_member(uuid, uuid)
to authenticated, service_role;

drop policy if exists "posts for members" on public.posts;
create policy "posts for members"
  on public.posts for select
  to authenticated
  using (
    is_member(community_id)
    and not exists (
      select 1 from blocks b where b.blocker = auth.uid() and b.blocked = posts.author_id
    )
  );

drop policy if exists "posts delete own" on public.posts;
create policy "posts delete own"
  on public.posts for delete
  to authenticated
  using (author_id = auth.uid() or is_owner(community_id));

drop policy if exists "reactions for members" on public.post_reactions;
create policy "reactions for members"
  on public.post_reactions for select
  to authenticated
  using (
    is_member(community_id)
    and not exists (
      select 1 from blocks b where b.blocker = auth.uid() and b.blocked = post_reactions.from_user
    )
  );

drop policy if exists "cards visible to both" on public.card_sends;
create policy "cards visible to both"
  on public.card_sends for select
  to authenticated
  using (
    from_user = auth.uid()
    or (
      to_user = auth.uid()
      and not exists (
        select 1 from blocks b where b.blocker = auth.uid() and b.blocked = card_sends.from_user
      )
    )
  );

drop policy if exists "cards insert" on public.card_sends;
create policy "cards insert"
  on public.card_sends for insert
  to authenticated
  with check (
    from_user = auth.uid()
    and is_member(community_id)
    and (drawing_url is null or is_own_file(drawing_url))
    and under_rate_limit('cards', 50)
    -- 相手にブロックされていたら送れません
    and not has_blocked(to_user, auth.uid())
    and exists (
      select 1 from memberships m
      where m.user_id = card_sends.to_user
        and m.community_id = card_sends.community_id
    )
  );

drop policy if exists "reports visible" on public.reports;
create policy "reports visible"
  on public.reports for select
  to authenticated
  using (reporter = auth.uid() or is_owner(community_id));

drop policy if exists "reports delete by owner" on public.reports;
create policy "reports delete by owner"
  on public.reports for delete
  to authenticated
  using (is_owner(community_id));

drop policy if exists "blocks own" on public.blocks;
create policy "blocks own"
  on public.blocks for select
  to authenticated
  using (blocker = auth.uid());

drop policy if exists "blocks insert own" on public.blocks;
create policy "blocks insert own"
  on public.blocks for insert
  to authenticated
  with check (blocker = auth.uid());

drop policy if exists "blocks delete own" on public.blocks;
create policy "blocks delete own"
  on public.blocks for delete
  to authenticated
  using (blocker = auth.uid());

-- ############################################################
--  2026-10-04_13_delete_own_items.sql
-- ############################################################

-- ============================================================
--  送ったカード・書いた手紙・チャットの自分の発言を消せるようにする
--  01_schema.sql と同じ許可です。
-- ============================================================

drop policy if exists "cards delete by sender" on public.card_sends;
create policy "cards delete by sender"
  on public.card_sends for delete
  to authenticated
  using (from_user = auth.uid());

drop policy if exists "capsules delete own" on public.time_capsules;
create policy "capsules delete own"
  on public.time_capsules for delete
  to authenticated
  using (author_id = auth.uid());

drop policy if exists "messages delete own" on public.messages;
create policy "messages delete own"
  on public.messages for delete
  to authenticated
  using (user_id = auth.uid());

-- ############################################################
--  2026-10-04_14_owner_handover.sql
-- ############################################################

-- ============================================================
--  作成者が抜けたら引き継ぎ、最後の1人が抜けたらコミュニティを消す
--
--  前は、作成者が抜けると作成者のいないコミュニティになり、
--  最後の1人が抜けたコミュニティも残り続けていました。
--  01_schema.sql の handle_member_left と同じものです。
--
--  ▼ すでに作成者がいないコミュニティも、ここで直します
-- ============================================================

create function public.handle_member_left()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update memberships
    set role = 'owner'
    where community_id = old.community_id
      and user_id = (
        select m.user_id from memberships m
        where m.community_id = old.community_id
        order by m.joined_at, m.user_id
        limit 1
      )
      and not exists (
        select 1 from memberships m
        where m.community_id = old.community_id and m.role = 'owner'
      );

  delete from communities c
    where c.id = old.community_id
      and not exists (select 1 from memberships m where m.community_id = old.community_id);

  return old;
end;
$$;

create trigger on_member_left
  after delete on public.memberships
  for each row execute function public.handle_member_left();

-- すでに作成者がいないコミュニティは、いちばん前から入っている人を作成者にします
update public.memberships m
  set role = 'owner'
  where m.user_id = (
      select first.user_id from public.memberships first
      where first.community_id = m.community_id
      order by first.joined_at, first.user_id
      limit 1
    )
    and not exists (
      select 1 from public.memberships o
      where o.community_id = m.community_id and o.role = 'owner'
    );

-- すでに誰もいないコミュニティは消します
delete from public.communities c
  where not exists (select 1 from public.memberships m where m.community_id = c.id);

-- ############################################################
--  2026-10-04_15_regenerate_invite_code.sql
-- ############################################################

-- ============================================================
--  招待コードを作り直せるようにする（作成者だけ）
--  01_schema.sql の regenerate_invite_code と同じものです。
-- ============================================================

create function public.regenerate_invite_code(target_community uuid)
returns text
language sql
security definer
set search_path to 'public'
as $$
  update communities
    set invite_code = make_invite_code()
    where id = target_community
      and is_owner(target_community)
    returning invite_code;
$$;

revoke execute on function public.regenerate_invite_code(uuid) from public, anon;
grant execute on function public.regenerate_invite_code(uuid) to authenticated, service_role;

-- ############################################################
--  2026-10-04_16_push_notifications.sql
-- ############################################################

-- ============================================================
--  スマホへの通知（プッシュ通知）のための表
--  01_schema.sql と同じものです。
-- ============================================================

-- ------------------------------------------------------------
--  スマホへの通知（プッシュ通知）
--  push_subscriptions … 通知を受け取る端末の宛先。1台につき1行。本人だけが読める・足せる・消せる
--  push_log           … もう通知を送ったもの（同じご報告やカードで、二度送らないため）。
--                       サーバー（service_role）だけが書きます
-- ------------------------------------------------------------
create table public.push_subscriptions (
  -- ブラウザが決める、その端末の宛先 URL
  endpoint text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 中身を暗号化するための鍵（ブラウザがくれます）
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

create table public.push_log (
  -- 'post' / 'card' / 'reaction' / 'letter'
  kind text not null,
  ref_id uuid not null,
  sent_at timestamptz not null default now(),
  primary key (kind, ref_id)
);
alter table public.push_log enable row level security;

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

drop policy if exists "push subscriptions own" on public.push_subscriptions;
create policy "push subscriptions own"
  on public.push_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "push subscriptions insert own" on public.push_subscriptions;
create policy "push subscriptions insert own"
  on public.push_subscriptions for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "push subscriptions update own" on public.push_subscriptions;
create policy "push subscriptions update own"
  on public.push_subscriptions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "push subscriptions delete own" on public.push_subscriptions;
create policy "push subscriptions delete own"
  on public.push_subscriptions for delete
  to authenticated
  using (user_id = auth.uid());

-- ############################################################
--  2026-10-04_17_letter_links.sql
-- ############################################################

-- ============================================================
--  手紙に置いたリンクを、受け取った人が開けるようにする
--
--  手紙の紙は1枚の絵にして送るので、紙に置いたリンクは押せませんでした。
--  リンクを別に持たせ、読む画面にリンクとして並べます。
--  01_schema.sql の are_web_links と time_capsules.links と同じものです。
-- ============================================================

create function public.are_web_links(links text[])
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  -- 長さは char_length で見ます（Postgres の正規表現は、{1,500} のような255より大きい回数を書けないため）
  select coalesce(bool_and(link ~ '^https?://[^[:space:]]+$' and char_length(link) <= 500), true)
  from unnest(links) as link;
$$;

alter table public.time_capsules
  add column links text[],
  add constraint time_capsules_links_check check (cardinality(links) <= 10 and are_web_links(links));

-- ############################################################
--  2026-10-04_18_error_reports.sql
-- ############################################################

-- ============================================================
--  エラーの記録を残す表
--  01_schema.sql の error_reports と同じものです。
-- ============================================================

-- ------------------------------------------------------------
--  エラーの記録（lib/reportError.ts）
--  サーバーや画面で思いがけないエラーが起きたときに、1行ずつ残します。
--  1日1回の処理（app/api/cron/daily）が、新しいものがあれば運営者にメールで知らせます。
--  サーバー（service_role）だけが読み書きします。許可を1つも出していないので、画面からは見えません
-- ------------------------------------------------------------
create table public.error_reports (
  id uuid primary key default gen_random_uuid(),
  -- どこで起きたか：'server' / 'client' / 'cron' / 'usage'（容量の見張り）
  source text not null,
  message text not null check (char_length(message) <= 2000),
  -- 起きた画面の URL など
  path text check (char_length(path) <= 500),
  detail jsonb check (pg_column_size(detail) <= 20000),
  created_at timestamptz not null default now()
);
alter table public.error_reports enable row level security;

create index error_reports_created_at_idx on public.error_reports (created_at desc);

-- ############################################################
--  2026-10-04_19_app_usage.sql
-- ############################################################

-- ============================================================
--  DB と保管庫の使用量を測る関数（容量の見張り）
--  01_schema.sql の app_usage と同じものです。
-- ============================================================

create function public.app_usage()
returns table (db_bytes bigint, storage_bytes bigint)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    pg_database_size(current_database()),
    coalesce((select sum((o.metadata ->> 'size')::bigint) from storage.objects o), 0)::bigint;
$$;

revoke execute on function public.app_usage() from public, anon, authenticated;
grant execute on function public.app_usage() to service_role;

-- ############################################################
--  2026-10-04_20_delete_own_photos.sql
-- ############################################################

-- ============================================================
--  自分のフォルダの写真を消せるようにする
--  写真を上げたあとに DB への書き込みが失敗したとき、画面から上げた写真を消すためです。
--  01_schema.sql の「photos delete own folder」と同じものです。
-- ============================================================

drop policy if exists "photos delete own folder" on storage.objects;
create policy "photos delete own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('posts', 'drawings', 'cards')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
