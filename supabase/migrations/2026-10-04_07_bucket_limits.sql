-- ============================================================
--  保管庫に置けるファイルの大きさと種類に、上限を付ける
--
--  前は上限が無く、自分のフォルダになら巨大なファイルや HTML・SVG も置けました。
--  01_schema.sql の「9. 保管庫」と同じ値です。
--  権限が無くて失敗したときは NOTICE が出ます。そのときは supabase/README.md の
--  「保管庫」の表のとおりに、ダッシュボードで各バケットの設定を変えてください。
-- ============================================================

do $$
begin
  update storage.buckets set file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'] where id = 'avatars';
  update storage.buckets set file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'] where id = 'posts';
  update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/png'] where id = 'drawings';
  update storage.buckets set file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'] where id = 'cards';
exception
  when insufficient_privilege then
    raise notice 'バケットの設定を SQL から変える権限がありませんでした。supabase/README.md の「保管庫」を見て、ダッシュボードで変えてください';
end $$;
