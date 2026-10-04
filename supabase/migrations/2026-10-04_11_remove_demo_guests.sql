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
