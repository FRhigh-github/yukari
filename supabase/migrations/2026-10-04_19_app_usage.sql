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
