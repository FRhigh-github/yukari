-- ============================================================
--  送ったカード・書いた手紙・チャットの自分の発言を消せるようにする
--  01_schema.sql と同じ許可です。
-- ============================================================

drop policy if exists "cards delete by sender" on public.card_sends;
create policy "cards delete by sender"
  on public.card_sends for delete
  to authenticated
  using (from_user = auth.uid());

drop policy if exists "capsules delete own" on public.time_capsules;
create policy "capsules delete own"
  on public.time_capsules for delete
  to authenticated
  using (author_id = auth.uid());

drop policy if exists "messages delete own" on public.messages;
create policy "messages delete own"
  on public.messages for delete
  to authenticated
  using (user_id = auth.uid());
