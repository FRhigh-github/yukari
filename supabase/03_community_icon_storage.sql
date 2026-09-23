-- グループアイコンの画像を、avatars の置き場所に上げられるようにします。
--
-- グループアイコンは avatars の中の、次の名前で保存しています。
--   communities/<コミュニティのid>.jpg
--
-- プロフィール写真の許可（自分のidの名前のファイルだけ）では、この名前は通りません。
-- そこで「そのコミュニティのメンバーなら、そのコミュニティの画像を上げてよい」という許可を足します。
--
-- storage.foldername(name) = ファイル名をフォルダごとに区切ったもの
--   'communities/abcd.jpg' → {'communities'}
-- storage.filename(name)   = フォルダを除いたファイル名
--   'communities/abcd.jpg' → 'abcd.jpg'

-- 何度流しても壊れないように、先に同じ名前の許可を消しておきます
drop policy if exists "community icon insert" on storage.objects;
drop policy if exists "community icon update" on storage.objects;
drop policy if exists "community icon select" on storage.objects;

-- 新しく上げる
create policy "community icon insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'communities'
    and public.is_member(replace(storage.filename(name), '.jpg', '')::uuid)
  );

-- 上書きする（画面では upsert = 同じ名前なら上書き、で上げているため必要です）
create policy "community icon update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'communities'
    and public.is_member(replace(storage.filename(name), '.jpg', '')::uuid)
  );

-- 上書きのときに、今あるファイルを確かめるために読む権限も要ります
create policy "community icon select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'communities'
  );
