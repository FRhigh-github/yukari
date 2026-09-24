-- ============================================================
--  04c：復旧の古い仕組み・関数の呼び出し・写真の置き場所
--
--  04_security.sql を、流しやすいように3つに分けたものです（中身は同じです）。
--  04a → 04b → 04c の順に、1つずつまるごと流してください。
--  何度流しても同じ結果になります。途中で止まったら、エラーの文を教えてください。
--
--  最後に、今ある許可の一覧が表で出ます。
-- ============================================================

-- ------------------------------------------------------------
--  0. 下ごしらえ
-- ------------------------------------------------------------
--  この表の「許可を確かめるスイッチ」（RLS）を入れます。
--  切れていると、許可をいくら作っても、誰でも全部読めてしまいます
--  （未来への手紙は、実際にこれが切れていて、誰でも読めていました）。
alter table public.recovery_approvals enable row level security;

--  この表の許可を、いったん全部消します（本番で画面から足された「誰でも読める」なども含めて）
do $$
declare
  p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('recovery_approvals')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------
--  9. 使っていない復旧の「承認」の仕組みを止めます
-- ------------------------------------------------------------
--  承認が3件たまると申請を勝手に「使用済み」にする仕掛けを外します。
--  表（recovery_approvals）は残しますが、許可を全部消したので誰も読み書きできません。
drop trigger if exists on_recovery_approved on public.recovery_approvals;
drop function if exists public.check_recovery_threshold();


-- ------------------------------------------------------------
--  14. 判定の関数を、ログインなしで呼べないようにします
-- ------------------------------------------------------------
--  recovery_is_unlocked はサーバー（service_role）だけが使います
revoke execute on function public.recovery_is_unlocked(uuid) from public, anon, authenticated;
grant execute on function public.recovery_is_unlocked(uuid) to service_role;

--  capsule_is_open はイベントの許可の中で使うので、ログインしている人には残します
revoke execute on function public.capsule_is_open(uuid) from public, anon;
grant execute on function public.capsule_is_open(uuid) to authenticated, service_role;


-- ------------------------------------------------------------
--  12. 写真の置き場所（posts / drawings / cards）
-- ------------------------------------------------------------
--  見るときのURLは、サーバーが service_role の鍵で作ります（lib/signedUrls.ts）。
--  なので、ログインした人に許すのは「自分の id のフォルダに置く」ことと、
--  「自分が置いたものを読む」ことだけです（置いた直後の確認に要るため）。
--  他人のものを読む・上書きする・消すは、誰にも許しません。
--
--  まず、この3つの置き場所に関する許可を、いったん全部消します
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (coalesce(qual, '') || coalesce(with_check, '')) ~ '''(posts|drawings|cards)'''
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

--  置き場所そのものを非公開にします（URLを知っていても、期限付きURLでなければ見られない）
update storage.buckets set public = false where id in ('posts', 'drawings', 'cards');

--  storage.foldername(name)[1] = いちばん上のフォルダ名。ここが自分の id であること
drop policy if exists "posts upload own folder" on storage.objects;
create policy "posts upload own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "drawings upload own folder" on storage.objects;
create policy "drawings upload own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'drawings' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "cards upload own folder" on storage.objects;
create policy "cards upload own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'cards' and (storage.foldername(name))[1] = auth.uid()::text
  );


drop policy if exists "posts read own folder" on storage.objects;
create policy "posts read own folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "drawings read own folder" on storage.objects;
create policy "drawings read own folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'drawings' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "cards read own folder" on storage.objects;
create policy "cards read own folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'cards' and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ------------------------------------------------------------
--  確認：流したあとの許可の一覧
-- ------------------------------------------------------------
--  最後にこれが表として出ます。
--  「using (true)」や「allow all」が残っていないかを見てください。
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in (
        'time_capsules', 'events', 'event_date_options', 'event_responses',
        'memberships', 'communities', 'profiles',
        'posts', 'post_reactions', 'card_sends', 'recovery_approvals'))
   or (schemaname = 'storage' and tablename = 'objects')
order by tablename, cmd, policyname;
