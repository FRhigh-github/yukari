-- ============================================================
--  04b：未来への手紙・イベント（日程調整）
--
--  04_security.sql を、流しやすいように3つに分けたものです（中身は同じです）。
--  04a → 04b → 04c の順に、1つずつまるごと流してください。
--  何度流しても同じ結果になります。途中で止まったら、エラーの文を教えてください。
--
--  未来への手紙は「書いた人」と「同じコミュニティで、開封日を過ぎた宛先の人」だけが読めます。
--  イベントは、手紙が開いたあとに、同じコミュニティの人に見えます。
-- ============================================================

-- ------------------------------------------------------------
--  0. 下ごしらえ
-- ------------------------------------------------------------
--  この表の「許可を確かめるスイッチ」（RLS）を入れます。
--  切れていると、許可をいくら作っても、誰でも全部読めてしまいます
--  （未来への手紙は、実際にこれが切れていて、誰でも読めていました）。
alter table public.time_capsules enable row level security;
alter table public.events enable row level security;
alter table public.event_date_options enable row level security;
alter table public.event_responses enable row level security;

--  この表の許可を、いったん全部消します（本番で画面から足された「誰でも読める」なども含めて）
do $$
declare
  p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('time_capsules', 'events', 'event_date_options', 'event_responses')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------
--  1. 未来への手紙（time_capsules）
-- ------------------------------------------------------------
--  読める：書いた本人はいつでも。
--          それ以外は、同じコミュニティで、開封日を過ぎていて、
--          宛先が「全員」か「自分」のものだけ。
drop policy if exists "capsules readable" on time_capsules;
create policy "capsules readable"
  on time_capsules for select
  to authenticated
  using (
    author_id = auth.uid()
    or (
      is_member(community_id)
      and open_at <= now()
      and (to_user is null or to_user = auth.uid())
    )
  );

drop policy if exists "capsules insert" on time_capsules;
create policy "capsules insert"
  on time_capsules for insert
  to authenticated
  with check (author_id = auth.uid() and is_member(community_id));


-- ------------------------------------------------------------
--  1. イベント（events / event_date_options / event_responses）
-- ------------------------------------------------------------
--  イベントは「手紙が開いたあと」に同じコミュニティの人に見えます。作った人はいつでも。
drop policy if exists "events readable" on events;
create policy "events readable"
  on events for select
  to authenticated
  using (
    is_member(community_id)
    and (capsule_is_open(capsule_id) or created_by = auth.uid())
  );

drop policy if exists "events insert" on events;
create policy "events insert"
  on events for insert
  to authenticated
  with check (created_by = auth.uid() and is_member(community_id));

drop policy if exists "events update by owner" on events;
create policy "events update by owner"
  on events for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

--  候補日は「そのイベントが見える人」に見えます。
--  exists の中の events にも上の許可が効くので、見えないイベントの候補日は見えません。
drop policy if exists "date options readable" on event_date_options;
create policy "date options readable"
  on event_date_options for select
  to authenticated
  using (exists (select 1 from events e where e.id = event_date_options.event_id));

--  候補日を足せるのは、イベントを作った人だけ
drop policy if exists "date options insert" on event_date_options;
create policy "date options insert"
  on event_date_options for insert
  to authenticated
  with check (
    is_member(community_id)
    and exists (
      select 1 from events e
      where e.id = event_date_options.event_id and e.created_by = auth.uid()
    )
  );

drop policy if exists "date options delete by event owner" on event_date_options;
create policy "date options delete by event owner"
  on event_date_options for delete
  to authenticated
  using (
    exists (
      select 1 from events e
      where e.id = event_date_options.event_id and e.created_by = auth.uid()
    )
  );

--  出欠の回答。
--  画面は回答を保存するときに community_id を送っていません。
--  そのため「コミュニティのメンバーか」は、候補日が見えるかどうかで確かめます。
--  （前は「誰でも何でもできる」許可で、これを通していました）
drop policy if exists "responses readable" on event_responses;
create policy "responses readable"
  on event_responses for select
  to authenticated
  using (
    exists (select 1 from event_date_options o where o.id = event_responses.option_id)
  );

drop policy if exists "responses insert own" on event_responses;
create policy "responses insert own"
  on event_responses for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from event_date_options o where o.id = event_responses.option_id)
  );

drop policy if exists "responses update own" on event_responses;
create policy "responses update own"
  on event_responses for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from event_date_options o where o.id = event_responses.option_id)
  );

drop policy if exists "responses delete own" on event_responses;
create policy "responses delete own"
  on event_responses for delete
  to authenticated
  using (user_id = auth.uid());


