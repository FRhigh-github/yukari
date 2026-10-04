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
