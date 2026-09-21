-- ============================================================
--  コミュニティの「退出」と「名前の変更」を許可する
--
--  使い方: Supabase ダッシュボード → SQL Editor に貼って Run
--  schema.sql を流したあとに実行してください。
--
--  schema.sql には select と insert の許可しか書いていないため、
--  delete（退出）と update（名前の変更）は DB 側で拒否されます。
--  この2つを足すと、画面から操作できるようになります。
-- ============================================================


-- 退出：自分の参加情報だけ消せる。
-- user_id = auth.uid() があるので、他人を追い出すことはできません。
create policy "memberships leave" on memberships
  for delete using (user_id = auth.uid());


-- 名前の変更：作ったユーザーだけができる。
-- using  = どの行を変更してよいか
-- with check = 変更したあとの中身が条件を満たしているか
--   （created_by を他人にすり替えられないようにするため、両方必要です）
create policy "communities update by owner" on communities
  for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
