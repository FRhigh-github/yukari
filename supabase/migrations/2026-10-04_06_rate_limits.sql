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
