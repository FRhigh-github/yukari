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
