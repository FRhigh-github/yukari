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
