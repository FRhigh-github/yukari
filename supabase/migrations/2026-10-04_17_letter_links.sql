-- ============================================================
--  手紙に置いたリンクを、受け取った人が開けるようにする
--
--  手紙の紙は1枚の絵にして送るので、紙に置いたリンクは押せませんでした。
--  リンクを別に持たせ、読む画面にリンクとして並べます。
--  01_schema.sql の are_web_links と time_capsules.links と同じものです。
-- ============================================================

create function public.are_web_links(links text[])
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  -- 長さは char_length で見ます（Postgres の正規表現は、{1,500} のような255より大きい回数を書けないため）
  select coalesce(bool_and(link ~ '^https?://[^[:space:]]+$' and char_length(link) <= 500), true)
  from unnest(links) as link;
$$;

alter table public.time_capsules
  add column links text[],
  add constraint time_capsules_links_check check (cardinality(links) <= 10 and are_web_links(links));
