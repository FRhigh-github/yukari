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
