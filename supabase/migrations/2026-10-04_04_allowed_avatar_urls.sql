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
