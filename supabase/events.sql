-- ============================================================
--  未来への手紙に付ける「イベントの日程調整」
--
--  使い方: Supabase ダッシュボード → SQL Editor に貼って Run
--  schema.sql を流したあとに実行してください。
--
--  手紙そのもの（文章・写真の自由配置）は画像にして
--  time_capsules.image_url に入れるので、そちら側の変更はありません。
--
--  ここで作るのは「あとから数える必要があるもの」だけです。
--  「11/1 → ○1 △0 ×0」のような集計は、画像では作れないためです。
-- ============================================================


-- ------------------------------------------------------------
--  0. 何度流しても大丈夫なように、先に消しておきます
--     （子 → 親 の順に消さないと、参照されていて消せません）
-- ------------------------------------------------------------

drop table if exists event_responses;
drop table if exists event_date_options;
drop table if exists events;
drop type  if exists attendance;
drop function if exists capsule_is_open(uuid);


-- ------------------------------------------------------------
--  1. 手紙が開いているかどうかを判定する関数
--
--  イベントは手紙の中身なので、開封日より前に見えてはいけません。
--
--  security definer にしているのは、is_member と同じ理由です。
--  time_capsules 自身にも「開封日前は返さない」という制限がかかっているので、
--  普通に書くと、この関数からも中身が見えず、常に false になってしまいます。
-- ------------------------------------------------------------

create or replace function capsule_is_open(target_capsule uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from time_capsules
    where id = target_capsule
      and open_at <= now()
  );
$$;


-- ------------------------------------------------------------
--  2. イベント
--
--  1通の手紙に、イベントは1つまで（unique）。
--
--  community_id を持たせているのは、権限の判定を
--  is_member(community_id) の1行で済ませるためです。
--  capsule_id からたどることもできますが、
--  そのたびに別のテーブルを見に行くことになります。
--  post_reactions も同じ作りにしてあります。
-- ------------------------------------------------------------

create table events (
  id           uuid primary key default gen_random_uuid(),
  capsule_id   uuid not null unique references time_capsules(id) on delete cascade,
  community_id uuid not null references communities(id) on delete cascade,
  created_by   uuid not null references profiles(id),
  name         text not null,
  created_at   timestamptz not null default now()
);

create index on events (community_id);


-- ------------------------------------------------------------
--  3. 候補日
--
--  1つのイベントに、日付を複数ぶら下げます。
--  unique (event_id, event_date) で、同じ日を2回入れられないようにしています。
-- ------------------------------------------------------------

create table event_date_options (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  community_id uuid not null references communities(id) on delete cascade,
  event_date   date not null,
  created_at   timestamptz not null default now(),
  unique (event_id, event_date)
);

create index on event_date_options (event_id, event_date);


-- ------------------------------------------------------------
--  4. 出欠の回答
--
--  ○ = yes / △ = maybe / × = no
--
--  primary key (option_id, user_id) にしているので、
--  「1人が1つの候補日に持てる回答は1つだけ」が DB 側で保証されます。
--  回答を変えるときは、新しく足すのではなく、この行を書き換えます。
-- ------------------------------------------------------------

create type attendance as enum ('yes', 'maybe', 'no');

create table event_responses (
  option_id    uuid not null references event_date_options(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  community_id uuid not null references communities(id) on delete cascade,
  answer       attendance not null,
  responded_at timestamptz not null default now(),
  primary key (option_id, user_id)
);

create index on event_responses (option_id);


-- ============================================================
--  5. アクセス権限（RLS）
-- ============================================================

alter table events             enable row level security;
alter table event_date_options enable row level security;
alter table event_responses    enable row level security;


-- イベント: 同じコミュニティで、かつ手紙が開いてから見える。
--           作った本人は、開く前でも確認できる。
create policy "events visible" on events
  for select using (
    is_member(community_id)
    and (capsule_is_open(capsule_id) or created_by = auth.uid())
  );

create policy "events insert" on events
  for insert with check (created_by = auth.uid() and is_member(community_id));

create policy "events update by owner" on events
  for update using (created_by = auth.uid());


-- 候補日: イベントと同じ条件でよいので、メンバーかどうかだけ見ます。
--         （イベント自体が見えなければ、候補日にもたどり着けません）
create policy "date options visible" on event_date_options
  for select using (is_member(community_id));

create policy "date options insert" on event_date_options
  for insert with check (is_member(community_id));

create policy "date options delete by event owner" on event_date_options
  for delete using (
    exists (
      select 1 from events e
      where e.id = event_id and e.created_by = auth.uid()
    )
  );


-- 回答: 同じコミュニティの人は全員の回答を見られる（○1 △0 ×0 の集計に使う）。
--       書き換えられるのは自分の回答だけ。
create policy "responses visible" on event_responses
  for select using (is_member(community_id));

create policy "responses insert own" on event_responses
  for insert with check (user_id = auth.uid() and is_member(community_id));

create policy "responses update own" on event_responses
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "responses delete own" on event_responses
  for delete using (user_id = auth.uid());


-- ============================================================
--  ここまで。Table Editor に events / event_date_options /
--  event_responses の3つが増えていれば成功です。
-- ============================================================
