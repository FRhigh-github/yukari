-- ============================================================
--  スマホへの通知（プッシュ通知）のための表
--  01_schema.sql と同じものです。
-- ============================================================

-- ------------------------------------------------------------
--  スマホへの通知（プッシュ通知）
--  push_subscriptions … 通知を受け取る端末の宛先。1台につき1行。本人だけが読める・足せる・消せる
--  push_log           … もう通知を送ったもの（同じご報告やカードで、二度送らないため）。
--                       サーバー（service_role）だけが書きます
-- ------------------------------------------------------------
create table public.push_subscriptions (
  -- ブラウザが決める、その端末の宛先 URL
  endpoint text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 中身を暗号化するための鍵（ブラウザがくれます）
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

create table public.push_log (
  -- 'post' / 'card' / 'reaction' / 'letter'
  kind text not null,
  ref_id uuid not null,
  sent_at timestamptz not null default now(),
  primary key (kind, ref_id)
);
alter table public.push_log enable row level security;

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

drop policy if exists "push subscriptions own" on public.push_subscriptions;
create policy "push subscriptions own"
  on public.push_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "push subscriptions insert own" on public.push_subscriptions;
create policy "push subscriptions insert own"
  on public.push_subscriptions for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "push subscriptions update own" on public.push_subscriptions;
create policy "push subscriptions update own"
  on public.push_subscriptions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "push subscriptions delete own" on public.push_subscriptions;
create policy "push subscriptions delete own"
  on public.push_subscriptions for delete
  to authenticated
  using (user_id = auth.uid());
