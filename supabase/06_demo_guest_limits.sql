-- ============================================================
--  デモのゲストは、デモ用コミュニティ以外に入れないようにする
--
--  「デモで入る」で作られたゲスト（メールの最後が @demo.yukari.invalid）は、
--  デモ用コミュニティ（app/api/demo-login が入れる）だけにいられるようにします。
--    ・招待コードで、ほかのコミュニティに参加できない（join_community）
--    ・新しいコミュニティを作れない（create_community）
--
--  auth.jwt() ->> 'email' = いまログインしている人のメールアドレス（ログインの証明書に入っています）
--
--  if を使わずに書いています（Supabase の SQL Editor が if のところで文を切ってしまうため）。
--  条件は where に書いて、「ゲストでないときだけ書き込む」形です。
--  何度流しても同じ結果になります。
-- ============================================================

-- ▼ 招待コードで参加する。
--   ゲストのときや、コードが違うときは、何もせず null を返します
--   （画面は、id が返ってこなければ「コードが違うようです」と出します）。
--   すでに入っているコミュニティのコードを入れたときは、何もせずそのコミュニティの id を返します。
drop function if exists public.join_community(text);
create function public.join_community(code text)
returns uuid
language sql
security definer
set search_path to 'public'
as $$
  with target as (
    select id from communities
    where invite_code = code
      and auth.uid() is not null
      and coalesce(auth.jwt() ->> 'email', '') not like '%@demo.yukari.invalid'
  ),
  joined as (
    insert into memberships (user_id, community_id)
    select auth.uid(), id from target
    on conflict do nothing
    returning community_id
  )
  select id from target;
$$;

revoke execute on function public.join_community(text) from public, anon;
grant execute on function public.join_community(text) to authenticated;

-- ▼ コミュニティを作る（04_security.sql と同じ中身に、「ゲストでないこと」を足したもの）
drop function if exists public.create_community(text, text);
create function public.create_community(community_name text, code text)
returns uuid
language sql
security definer
set search_path to 'public'
as $$
  with created as (
    insert into communities (name, invite_code, created_by)
    select trim(community_name), code, auth.uid()
    where auth.uid() is not null
      and coalesce(auth.jwt() ->> 'email', '') not like '%@demo.yukari.invalid'
      and length(trim(coalesce(community_name, ''))) between 1 and 40
    returning id
  ),
  joined as (
    insert into memberships (user_id, community_id, role)
    select auth.uid(), id, 'owner'::member_role from created
    returning community_id
  )
  select community_id from joined;
$$;

revoke execute on function public.create_community(text, text) from public, anon;
grant execute on function public.create_community(text, text) to authenticated;
