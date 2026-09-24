-- ============================================================
--  写真の置き場所の「誰でも読める・置ける」を消す
--
--  本番の DB に、置き場所の名前を指定しない許可が残っていました。
--    authenticated can read   … ログインしていれば、どの置き場所のどの写真でも読める・一覧できる
--    authenticated can upload … ログインしていれば、どの置き場所にも写真を置ける
--  これがあると、デモのゲストからも、ほかの人の投稿の写真や手書きのお祝いが一覧できてしまいます。
--
--  ただし、プロフィールのアイコン（avatars/<自分の id>.jpg）を上げる処理は、
--  いまこの「誰でも置ける」に頼っているので、代わりに「自分のアイコンだけ置ける」許可を足します。
--  （avatars は公開の置き場所なので、見るための許可はいりません）
--
--  何度流しても同じ結果になります。関数も if も使っていません。
-- ============================================================

drop policy if exists "authenticated can read" on storage.objects;
drop policy if exists "authenticated can upload" on storage.objects;

-- ▼ 自分のアイコンだけ、置ける・上書きできる・（上書きのために）読める
--   storage.filename(name) = フォルダを除いたファイル名。'<自分の id>.jpg' のときだけ通します。
--   上書き（upsert）するので、置く・上書き・読むの3つが要ります
drop policy if exists "avatar insert own" on storage.objects;
create policy "avatar insert own"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');

drop policy if exists "avatar update own" on storage.objects;
create policy "avatar update own"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');

drop policy if exists "avatar read own" on storage.objects;
create policy "avatar read own"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');

-- 確かめ用：写真の置き場所の許可の一覧
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by cmd, policyname;
