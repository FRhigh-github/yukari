-- ============================================================
--  アイコンのファイル名に、ランダムな id を入れる
--
--  avatars は公開の置き場所なので、URL さえ分かれば誰でも見られます。
--  前は「<ユーザーの id>.jpg」「communities/<コミュニティの id>.jpg」という名前で、
--  id を知っている人なら URL を作れてしまいました。
--  これからは「<id>/<ランダムな id>.jpg」に置き、変えたら前のファイルを消します。
--  01_schema.sql の「9. 保管庫」と set_community_icon と同じものです。
--
--  ▼ 流したあとに
--    前の形のファイルは、持ち主がアイコンを変えたときに消えます。
--    すぐに全部消したいときは、ダッシュボードの Storage → avatars で、
--    フォルダに入っていない「<id>.jpg」と「communities/<id>.jpg」を消してください。
-- ============================================================

drop policy "avatar insert own" on storage.objects;
drop policy "avatar update own" on storage.objects;
drop policy "avatar read own" on storage.objects;
drop policy "community icon insert" on storage.objects;
drop policy "community icon update" on storage.objects;
drop policy "community icon read" on storage.objects;

-- プロフィールのアイコン：avatars/<自分の id>/<ランダムな id>.jpg（lib/avatarFile.ts）。
-- ▼ 名前にランダムな id を入れている理由
--   avatars は公開の置き場所なので、URL さえ分かれば誰でも見られます。
--   前は「<自分の id>.jpg」で、id を知っている人なら URL を作れてしまいました。
-- 置く・読む・消す の3つです（上書きはしないので、書き換えの許可はありません）。
-- 読む・消すは、前の形（<自分の id>.jpg）のファイルも片づけられるように、そちらも認めます
create policy "avatar insert own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and name ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$')
  );

create policy "avatar read own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or name = auth.uid()::text || '.jpg')
  );

create policy "avatar delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or name = auth.uid()::text || '.jpg')
  );

-- コミュニティのアイコン：avatars/communities/<コミュニティの id>/<ランダムな id>.jpg。
-- そのコミュニティのメンバーだけ（ゲストは除く）。
-- ▼ id の比べ方について
--   ファイル名を uuid に変換して比べると、uuid でない名前のときにエラーで止まります。
--   文字のまま比べれば、合わないだけで済みます。
--   coalesce の2つめは、前の形（communities/<コミュニティの id>.jpg）を片づけるためです
create policy "community icon insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and name ~ '^communities/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
    and not public.is_demo_guest()
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.community_id::text = (storage.foldername(name))[2]
    )
  );

create policy "community icon read"
  on storage.objects for select
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

create policy "community icon delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'communities'
    and not public.is_demo_guest()
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.community_id::text = coalesce(
          (storage.foldername(name))[2],
          replace(storage.filename(name), '.jpg', '')
        )
    )
  );


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
      and not is_demo_guest()
      -- ~ は「この形に合っているか」を調べる記号（正規表現）。
      and url ~ (
        '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/communities/'
        || target_community::text || '/[0-9a-f-]{36}\.jpg$'
      )
    returning 1
  )
  select exists (select 1 from changed);
$$;
