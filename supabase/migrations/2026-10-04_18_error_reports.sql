-- ============================================================
--  エラーの記録を残す表
--  01_schema.sql の error_reports と同じものです。
-- ============================================================

-- ------------------------------------------------------------
--  エラーの記録（lib/reportError.ts）
--  サーバーや画面で思いがけないエラーが起きたときに、1行ずつ残します。
--  1日1回の処理（app/api/cron/daily）が、新しいものがあれば運営者にメールで知らせます。
--  サーバー（service_role）だけが読み書きします。許可を1つも出していないので、画面からは見えません
-- ------------------------------------------------------------
create table public.error_reports (
  id uuid primary key default gen_random_uuid(),
  -- どこで起きたか：'server' / 'client' / 'cron' / 'usage'（容量の見張り）
  source text not null,
  message text not null check (char_length(message) <= 2000),
  -- 起きた画面の URL など
  path text check (char_length(path) <= 500),
  detail jsonb check (pg_column_size(detail) <= 20000),
  created_at timestamptz not null default now()
);
alter table public.error_reports enable row level security;

create index error_reports_created_at_idx on public.error_reports (created_at desc);
