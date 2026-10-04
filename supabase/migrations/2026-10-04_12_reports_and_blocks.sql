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
