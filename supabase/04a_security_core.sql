-- ============================================================
--  04a：コミュニティ・メンバー・プロフィール・投稿・お祝い・カード
--
--  04_security.sql を、流しやすいように3つに分けたものです（中身は同じです）。
--  04a → 04b → 04c の順に、1つずつまるごと流してください。
--  何度流しても同じ結果になります。途中で止まったら、エラーの文を教えてください。
--
--  いちばん大事な分です。これが通ると、ホームやプロフィールがまた見えるようになります。
-- ============================================================

-- ------------------------------------------------------------
--  0. 下ごしらえ
-- ------------------------------------------------------------
--  この表の「許可を確かめるスイッチ」（RLS）を入れます。
--  切れていると、許可をいくら作っても、誰でも全部読めてしまいます
--  （未来への手紙は、実際にこれが切れていて、誰でも読めていました）。
alter table public.communities enable row level security;
alter table public.memberships enable row level security;
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_reactions enable row level security;
alter table public.card_sends enable row level security;

--  この表の許可を、いったん全部消します（本番で画面から足された「誰でも読める」なども含めて）
do $$
declare
  p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('communities', 'memberships', 'profiles', 'posts', 'post_reactions', 'card_sends')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------
--  使う関数：同じコミュニティにいるか
-- ------------------------------------------------------------
--  「自分と相手が、どこか1つでも同じコミュニティにいるか」を返します。
--  security definer = memberships の許可に止められずに数えるための指定です
--  （is_member と同じ考え方）。
create or replace function public.shares_community(other uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from memberships mine
    join memberships theirs on theirs.community_id = mine.community_id
    where mine.user_id = auth.uid()
      and theirs.user_id = other
  );
$$;


-- ------------------------------------------------------------
--  2. コミュニティと参加（communities / memberships）
-- ------------------------------------------------------------
drop policy if exists "communities for members" on communities;
create policy "communities for members"
  on communities for select
  to authenticated
  using (is_member(id));

--  15. 作成者が変えられるのは名前などだけ。作成者の欄は自分のまま
drop policy if exists "communities update by owner" on communities;
create policy "communities update by owner"
  on communities for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

--  communities と memberships への「直接の追加」は許可しません。
--  追加は、下の create_community（作る）と join_community（招待コードで入る）だけです。
drop policy if exists "memberships visible" on memberships;
create policy "memberships visible"
  on memberships for select
  to authenticated
  using (user_id = auth.uid() or is_member(community_id));

drop policy if exists "memberships leave" on memberships;
create policy "memberships leave"
  on memberships for delete
  to authenticated
  using (user_id = auth.uid());

--  コミュニティを作って、自分を owner として入れる関数
--  ▼ if を使わずに書いています。
--    Supabase の SQL Editor は、関数の中に if ... then があると、そこで文を切ってしまい、
--    「unterminated dollar-quoted string」で止まっていました。
--    条件は where に書いて、「条件に合ったときだけ書き込む」形にしています。
--  名前が1〜40文字で、ログインしているときだけ作ります。合わなければ何もせず null を返します
--  （画面は、id が返ってこなければ「作成に失敗しました」と出します）。
drop function if exists public.create_community(text, text);
create function public.create_community(community_name text, code text)
returns uuid
language sql
security definer
set search_path to 'public'
as $$
  with created as (
    insert into communities (name, invite_code, created_by)
    select trim(community_name), code, auth.uid()
    where auth.uid() is not null
      and length(trim(coalesce(community_name, ''))) between 1 and 40
    returning id
  ),
  joined as (
    insert into memberships (user_id, community_id, role)
    select auth.uid(), id, 'owner'::member_role from created
    returning community_id
  )
  select community_id from joined;
$$;

--  関数を呼べるのは、ログインしている人だけにします
revoke execute on function public.create_community(text, text) from public, anon;
grant execute on function public.create_community(text, text) to authenticated;


-- ------------------------------------------------------------
--  3. プロフィール（profiles）
-- ------------------------------------------------------------
--  読める：自分と、同じコミュニティにいる人だけ。
--  ログインしていない人は、誰のものも読めません。
drop policy if exists "profiles readable" on profiles;
create policy "profiles readable"
  on profiles for select
  to authenticated
  using (id = auth.uid() or shares_community(id));

drop policy if exists "profiles self insert" on profiles;
create policy "profiles self insert"
  on profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles self update" on profiles;
create policy "profiles self update"
  on profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());


-- ------------------------------------------------------------
--  4. グループのアイコンに入れられるURLを絞る
-- ------------------------------------------------------------
--  このアプリの置き場所（avatars/communities/<コミュニティのid>.jpg）のURLだけ受け付けます。
--  何でも入れられると、よそのサイトの画像（見た人を記録する仕掛けなど）を出させられるためです。
--  ▼ if を使わずに書いています。
--    Supabase の SQL Editor は、関数の中に if ... then があると、そこで文を切ってしまい、
--    「unterminated dollar-quoted string」で止まっていました。
--    条件は where に書いて、「条件に合ったときだけ書き込む」形にしています。
--  メンバーで、URL がこのアプリの置き場所のものなら変えて true、そうでなければ何もせず false を返します。
--  前の関数と返すものが違うので、先に消してから作ります
drop function if exists public.set_community_icon(uuid, text);
create function public.set_community_icon(target_community uuid, url text)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  with changed as (
    update communities set icon_url = url
    where id = target_community
      and is_member(target_community)
      -- like の % は「何が入っていてもよい」。?t=... の後ろ付きも通します
      and url like 'https://%.supabase.co/storage/v1/object/public/avatars/communities/'
                   || target_community::text || '.jpg%'
    returning 1
  )
  select exists (select 1 from changed);
$$;


-- ------------------------------------------------------------
--  コミュニティの名前を、メンバーなら誰でも変えられる関数
-- ------------------------------------------------------------
--  アイコンと同じく、名前も「間違えても直せばいいもの」なので、作成者だけに限りません。
--  表を直接書き換える許可(communities update)は作成者だけのままにして、
--  名前だけを変えるこの関数を用意します（招待コードなどは変えられません）。
--  ▼ if を使わずに書いています。
--    Supabase の SQL Editor は、関数の中に if ... then があると、そこで文を切ってしまい、
--    「unterminated dollar-quoted string」で止まっていました。
--    条件は where に書いて、「条件に合ったときだけ書き込む」形にしています。
--  メンバーで、名前が1〜40文字なら変えて true、そうでなければ何もせず false を返します
drop function if exists public.rename_community(uuid, text);
create function public.rename_community(target_community uuid, new_name text)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  with changed as (
    update communities set name = trim(new_name)
    where id = target_community
      and is_member(target_community)
      and length(trim(coalesce(new_name, ''))) between 1 and 40
    returning 1
  )
  select exists (select 1 from changed);
$$;

revoke execute on function public.rename_community(uuid, text) from public, anon;
grant execute on function public.rename_community(uuid, text) to authenticated;


-- ------------------------------------------------------------
--  5・11・13. 投稿とお祝い（posts / post_reactions）
-- ------------------------------------------------------------
drop policy if exists "posts for members" on posts;
create policy "posts for members"
  on posts for select
  to authenticated
  using (is_member(community_id));

drop policy if exists "posts insert" on posts;
create policy "posts insert"
  on posts for insert
  to authenticated
  with check (author_id = auth.uid() and is_member(community_id));

--  5. 書き換えたあとも「自分の投稿で、自分が入っているコミュニティ」でなければいけません
drop policy if exists "posts update own" on posts;
create policy "posts update own"
  on posts for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and is_member(community_id));

--  11. 自分の投稿は消せます
drop policy if exists "posts delete own" on posts;
create policy "posts delete own"
  on posts for delete
  to authenticated
  using (author_id = auth.uid());

drop policy if exists "reactions for members" on post_reactions;
create policy "reactions for members"
  on post_reactions for select
  to authenticated
  using (is_member(community_id));

--  13. お祝いを付ける投稿が、本当にそのコミュニティのものかも確かめます
drop policy if exists "reactions insert" on post_reactions;
create policy "reactions insert"
  on post_reactions for insert
  to authenticated
  with check (
    from_user = auth.uid()
    and is_member(community_id)
    and exists (
      select 1 from posts p
      where p.id = post_reactions.post_id
        and p.community_id = post_reactions.community_id
    )
  );

--  11. 自分が送ったお祝いは消せます
drop policy if exists "reactions delete own" on post_reactions;
create policy "reactions delete own"
  on post_reactions for delete
  to authenticated
  using (from_user = auth.uid());


-- ------------------------------------------------------------
--  10. カード（card_sends）
-- ------------------------------------------------------------
drop policy if exists "cards visible to both" on card_sends;
create policy "cards visible to both"
  on card_sends for select
  to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

--  送る相手も、同じコミュニティのメンバーでなければいけません
drop policy if exists "cards insert" on card_sends;
create policy "cards insert"
  on card_sends for insert
  to authenticated
  with check (
    from_user = auth.uid()
    and is_member(community_id)
    and exists (
      select 1 from memberships m
      where m.user_id = card_sends.to_user
        and m.community_id = card_sends.community_id
    )
  );


