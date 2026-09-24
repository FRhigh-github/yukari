-- ============================================================
--  セキュリティの見直し（2026-09-24）
--
--  Supabase の SQL Editor に、このファイルをまるごと貼って流してください。
--  何度流しても同じ結果になるように書いてあります。
--  途中で止まったときも、もう一度まるごと流せば、最後まで通ります
--  （許可を作る前に、同じ名前の許可があれば必ず消しているため）。
--
--  ▼ やり方
--    本番の DB には、手元のファイル（01_schema.sql）に無い許可が
--    画面から後で足されていました（「誰でも読める」「誰でも何でもできる」など）。
--    どれが足されているかを1つずつ確かめる代わりに、
--    対象の表の許可を「いったん全部消してから、正しいものだけ作り直す」やり方にしています。
--
--  ▼ 直すこと（番号は相談したときのもの）
--    1  未来への手紙・イベントが、ログインなしで読める／書き換えられる
--    2  招待コードなしで、どのコミュニティにも入れる
--    3  全員のプロフィールが、ログインなしで読める
--    4  グループのアイコンに、どんなURLでも入れられる
--    5  自分の投稿を、入っていないコミュニティへ移せる
--    6  手元のファイルと本番がずれている（→ このファイルが今の正しい形）
--    9  使っていない復旧の「承認」の仕組みを、誰でも動かせる
--    10 知らない人にもカードを送りつけられる
--    11 自分の投稿・お祝いを消せない
--    12 写真の置き場所（posts / drawings / cards）の決まりがファイルに無い
--    13 別のコミュニティの投稿にも、お祝いを付けられる
--    14 手紙の開封・復旧の判定の関数を、ログインなしで呼べる
--    15 コミュニティの作成者が、作成者の欄を他人に書き換えられる
--
--  ▼ 画面側も合わせて変えてあります（このファイルを流したら、すぐに反映してください）
--    ・コミュニティを作る … create_community を呼ぶ（CommunityCreateForm.tsx）
--    ・投稿とカードの写真 … 「自分の id / ファイル名」に置く（PostForm.tsx / CardComposer.tsx）
--    ・写真のURL         … サーバーで作る（lib/signedUrls.ts）
-- ============================================================


-- ------------------------------------------------------------
--  0. 下ごしらえ：対象の表の許可を、いったん全部消します
-- ------------------------------------------------------------
--  pg_policies = 今ある許可の一覧。ここから名前を拾って、1つずつ消します。
do $$
declare
  p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'time_capsules', 'events', 'event_date_options', 'event_responses',
        'memberships', 'communities', 'profiles',
        'posts', 'post_reactions', 'card_sends', 'recovery_approvals'
      )
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

--  許可を確かめるスイッチ（RLS）を入れます。切れていると、許可に関係なく誰でも全部読めます
--  （未来への手紙は、実際にこれが切れていて、誰でも読めていました）
alter table public.time_capsules enable row level security;
alter table public.events enable row level security;
alter table public.event_date_options enable row level security;
alter table public.event_responses enable row level security;
alter table public.memberships enable row level security;
alter table public.communities enable row level security;
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_reactions enable row level security;
alter table public.card_sends enable row level security;
alter table public.recovery_approvals enable row level security;


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
