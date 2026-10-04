-- ============================================================
--  自分のフォルダの写真を消せるようにする
--  写真を上げたあとに DB への書き込みが失敗したとき、画面から上げた写真を消すためです。
--  01_schema.sql の「photos delete own folder」と同じものです。
-- ============================================================

drop policy if exists "photos delete own folder" on storage.objects;
create policy "photos delete own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('posts', 'drawings', 'cards')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
