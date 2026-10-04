-- ============================================================
--  思い出ログインの申請を、本人と、同じコミュニティにいる全員に見せる
--
--  前は「申請を立てたコミュニティ（入っているうちの1つ）」の人にしか見えず、
--  ほかのコミュニティの人や、本当の持ち主は、乗っ取りに気づいても止められませんでした。
--  01_schema.sql の「思い出ログイン」の許可と同じものです。
-- ============================================================

drop policy "recovery requests for members" on public.recovery_requests;
drop policy "recovery vetoes for members" on public.recovery_vetoes;
drop policy "recovery vetoes insert" on public.recovery_vetoes;

-- 申請は、復旧しようとしている人と、どこか1つでも同じコミュニティにいる人に見えます
-- （誰でも止められるように）。書くのはサーバー（service_role）だけです。
-- ▼ 前は「申請を立てたコミュニティ」の人にしか見えませんでした
--   2つ以上のコミュニティに入っている人の場合、そのうち1つの人にしか知らせが出ず、
--   ほかのコミュニティの人は、乗っ取りに気づいても止められませんでした。
-- ▼ 本人（target_user）にも見せます
--   本当の持ち主がまだログインできているなら、それは乗っ取りです。本人がいちばん早く気づけます
create policy "recovery requests visible"
  on public.recovery_requests for select
  to authenticated
  using (
    target_user = auth.uid()
    or is_member(community_id)
    or shares_community(target_user)
  );

-- 止めた記録は、その申請が見える人に見えます。
-- exists の中の recovery_requests にも上の許可が効くので、見えない申請の分は見えません
create policy "recovery vetoes visible"
  on public.recovery_vetoes for select
  to authenticated
  using (
    exists (select 1 from recovery_requests r where r.id = recovery_vetoes.request_id)
  );

create policy "recovery vetoes insert"
  on public.recovery_vetoes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from recovery_requests r
      where r.id = recovery_vetoes.request_id
        and r.status = 'pending'
    )
  );
