-- ============================================================
--  ゆかり / データベースの設計図
--
--  いまの Supabase の中身から書き出して、流せる順に並べ直したものです。
--  新しい環境を作るときは、いちばん最初にこれを流します。
--  そのあと seed.sql を流すと、確認用のデータが入ります。
--
--  ▼ このファイルに入っていないもの
--    ・アカウント（auth.users の中身）
--    ・保管庫（バケット）。ダッシュボードから作ります。README.md 参照
-- ============================================================

-- ------------------------------------------------------------
--  決められた選択肢（enum）
--  ここにない値を入れようとすると、DBが受け付けません。
-- ------------------------------------------------------------

create type attendance as enum ('yes', 'maybe', 'no');

create type card_kind as enum ('newyear', 'summer', 'birthday', 'custom');

create type contact_type as enum ('email', 'phone', 'passkey', 'recovery_code');

create type interaction_kind as enum ('card', 'reaction', 'comment', 'capsule');

create type member_role as enum ('owner', 'member');

create type recovery_status as enum ('pending', 'approved', 'rejected', 'expired');

create type user_status as enum ('active', 'lost', 'deleted');

-- ------------------------------------------------------------
--  テーブル
-- ------------------------------------------------------------

create table card_sends (
  id uuid default gen_random_uuid() not null,
  template_id uuid not null,
  from_user uuid not null,
  to_user uuid not null,
  community_id uuid not null,
  drawing_url text,
  drawing_data jsonb,
  message text,
  sent_at timestamp with time zone default now() not null
);

create table card_templates (
  id uuid default gen_random_uuid() not null,
  kind card_kind not null,
  name text not null,
  image_url text not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null
);

create table communities (
  id uuid default gen_random_uuid() not null,
  name text not null,
  invite_code text not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null
);

create table event_date_options (
  id uuid default gen_random_uuid() not null,
  event_id uuid not null,
  community_id uuid not null,
  event_date date not null,
  created_at timestamp with time zone default now() not null
);

create table event_responses (
  option_id uuid not null,
  user_id uuid not null,
  community_id uuid,
  answer attendance,
  responded_at timestamp with time zone default now() not null,
  comment text not null
);

create table events (
  id uuid default gen_random_uuid() not null,
  capsule_id uuid not null,
  community_id uuid not null,
  created_by uuid not null,
  name text not null,
  created_at timestamp with time zone default now() not null
);

create table interactions (
  id uuid default gen_random_uuid() not null,
  user_a uuid not null,
  user_b uuid not null,
  kind interaction_kind not null,
  occurred_at timestamp with time zone default now() not null
);

create table memberships (
  user_id uuid not null,
  community_id uuid not null,
  role member_role default 'member'::member_role not null,
  joined_at timestamp with time zone default now() not null
);

create table messages (
  id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now() not null,
  event_id uuid default gen_random_uuid(),
  user_id uuid default gen_random_uuid(),
  content text
);

create table post_reactions (
  id uuid default gen_random_uuid() not null,
  post_id uuid not null,
  from_user uuid not null,
  community_id uuid not null,
  drawing_url text not null,
  drawing_data jsonb,
  created_at timestamp with time zone default now() not null
);

create table posts (
  id uuid default gen_random_uuid() not null,
  author_id uuid not null,
  community_id uuid not null,
  title text not null,
  body text,
  image_url text not null,
  created_at timestamp with time zone default now() not null
);

create table profiles (
  id uuid not null,
  display_name text not null,
  birthday date,
  avatar_url text,
  status user_status default 'active'::user_status not null,
  created_at timestamp with time zone default now() not null,
  mood text
);

create table recovery_approvals (
  request_id uuid not null,
  approver_id uuid not null,
  approved_at timestamp with time zone default now() not null
);

create table recovery_codes (
  id uuid default gen_random_uuid() not null,
  code text not null,
  target_user uuid not null,
  issued_by uuid not null,
  expires_at timestamp with time zone default (now() + '24:00:00'::interval) not null,
  used boolean default false not null,
  created_at timestamp with time zone default now() not null
);

create table recovery_contacts (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  type contact_type not null,
  value text not null,
  verified_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table recovery_requests (
  id uuid default gen_random_uuid() not null,
  target_user uuid not null,
  community_id uuid not null,
  reason text,
  status recovery_status default 'pending'::recovery_status not null,
  requested_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone default (now() + '7 days'::interval) not null
);

create table recovery_vetoes (
  request_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table time_capsules (
  id uuid default gen_random_uuid() not null,
  community_id uuid not null,
  author_id uuid not null,
  to_user uuid,
  title text,
  body text,
  image_url text,
  sealed_at timestamp with time zone default now() not null,
  open_at timestamp with time zone not null
);

-- ------------------------------------------------------------
--  つながり（主キー・外部キー・一意・チェック）
--  テーブルを全部作ってから付けます。
--  作りながら付けると、まだ無い相手を参照してしまうためです。
-- ------------------------------------------------------------

-- まず主キーと一意。外部キーは「相手に主キーがあること」が前提なので、
-- これらを先に付けないと通りません。

alter table card_sends add constraint card_sends_pkey PRIMARY KEY (id);

alter table card_templates add constraint card_templates_pkey PRIMARY KEY (id);

alter table communities add constraint communities_invite_code_key UNIQUE (invite_code);

alter table communities add constraint communities_pkey PRIMARY KEY (id);

alter table event_date_options add constraint event_date_options_pkey PRIMARY KEY (id);

alter table event_date_options add constraint event_date_options_event_id_event_date_key UNIQUE (event_id, event_date);

alter table event_responses add constraint event_responses_pkey PRIMARY KEY (option_id, user_id);

alter table events add constraint events_capsule_id_key UNIQUE (capsule_id);

alter table events add constraint events_pkey PRIMARY KEY (id);

alter table interactions add constraint interactions_pkey PRIMARY KEY (id);

alter table memberships add constraint memberships_pkey PRIMARY KEY (user_id, community_id);

alter table messages add constraint massage_pkey PRIMARY KEY (id);

alter table post_reactions add constraint post_reactions_pkey PRIMARY KEY (id);

alter table posts add constraint posts_pkey PRIMARY KEY (id);

alter table profiles add constraint profiles_pkey PRIMARY KEY (id);

alter table recovery_approvals add constraint recovery_approvals_pkey PRIMARY KEY (request_id, approver_id);

alter table recovery_codes add constraint recovery_codes_target_user_issued_by_key UNIQUE (target_user, issued_by);

alter table recovery_codes add constraint recovery_codes_code_key UNIQUE (code);

alter table recovery_codes add constraint recovery_codes_pkey PRIMARY KEY (id);

alter table recovery_contacts add constraint recovery_contacts_pkey PRIMARY KEY (id);

alter table recovery_requests add constraint recovery_requests_pkey PRIMARY KEY (id);

alter table recovery_vetoes add constraint recovery_vetoes_pkey PRIMARY KEY (request_id, user_id);

alter table time_capsules add constraint time_capsules_pkey PRIMARY KEY (id);

-- そのうえで外部キーとチェック

alter table card_sends add constraint card_sends_from_user_fkey FOREIGN KEY (from_user) REFERENCES profiles(id) ON DELETE CASCADE;

alter table card_sends add constraint card_sends_to_user_fkey FOREIGN KEY (to_user) REFERENCES profiles(id) ON DELETE CASCADE;

alter table card_sends add constraint card_sends_template_id_fkey FOREIGN KEY (template_id) REFERENCES card_templates(id);

alter table card_sends add constraint card_sends_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE;

alter table card_templates add constraint card_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);

alter table communities add constraint communities_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);

alter table event_date_options add constraint event_date_options_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

alter table event_date_options add constraint event_date_options_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE;

alter table event_responses add constraint event_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table event_responses add constraint event_responses_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE;

alter table event_responses add constraint event_responses_option_id_fkey FOREIGN KEY (option_id) REFERENCES event_date_options(id) ON DELETE CASCADE;

alter table events add constraint events_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);

alter table events add constraint events_capsule_id_fkey FOREIGN KEY (capsule_id) REFERENCES time_capsules(id) ON DELETE CASCADE;

alter table events add constraint events_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE;

alter table interactions add constraint interactions_check CHECK ((user_a <> user_b));

alter table interactions add constraint interactions_user_a_fkey FOREIGN KEY (user_a) REFERENCES profiles(id) ON DELETE CASCADE;

alter table interactions add constraint interactions_user_b_fkey FOREIGN KEY (user_b) REFERENCES profiles(id) ON DELETE CASCADE;

alter table memberships add constraint memberships_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE;

alter table memberships add constraint memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table post_reactions add constraint post_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;

alter table post_reactions add constraint post_reactions_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE;

alter table post_reactions add constraint post_reactions_from_user_fkey FOREIGN KEY (from_user) REFERENCES profiles(id) ON DELETE CASCADE;

alter table posts add constraint posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table posts add constraint posts_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE;

alter table profiles add constraint profiles_mood_check CHECK (((mood IS NULL) OR (mood = ANY (ARRAY['want_to_meet'::text, 'busy'::text]))));

alter table profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table recovery_approvals add constraint recovery_approvals_request_id_fkey FOREIGN KEY (request_id) REFERENCES recovery_requests(id) ON DELETE CASCADE;

alter table recovery_approvals add constraint recovery_approvals_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table recovery_codes add constraint recovery_codes_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table recovery_codes add constraint recovery_codes_target_user_fkey FOREIGN KEY (target_user) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table recovery_contacts add constraint recovery_contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table recovery_requests add constraint recovery_requests_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE;

alter table recovery_requests add constraint recovery_requests_target_user_fkey FOREIGN KEY (target_user) REFERENCES profiles(id) ON DELETE CASCADE;

alter table recovery_vetoes add constraint recovery_vetoes_request_id_fkey FOREIGN KEY (request_id) REFERENCES recovery_requests(id) ON DELETE CASCADE;

alter table recovery_vetoes add constraint recovery_vetoes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table time_capsules add constraint time_capsules_to_user_fkey FOREIGN KEY (to_user) REFERENCES profiles(id) ON DELETE CASCADE;

alter table time_capsules add constraint time_capsules_community_id_fkey FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE;

alter table time_capsules add constraint time_capsules_check CHECK ((open_at > sealed_at));

alter table time_capsules add constraint time_capsules_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ------------------------------------------------------------
--  索引（探すときの目次）
-- ------------------------------------------------------------

CREATE INDEX card_sends_community_id_idx ON public.card_sends USING btree (community_id);

CREATE INDEX card_sends_to_user_sent_at_idx ON public.card_sends USING btree (to_user, sent_at DESC);

CREATE INDEX card_sends_from_user_sent_at_idx ON public.card_sends USING btree (from_user, sent_at DESC);

CREATE INDEX card_sends_template_id_idx ON public.card_sends USING btree (template_id);

CREATE INDEX event_date_options_event_id_event_date_idx ON public.event_date_options USING btree (event_id, event_date);

CREATE INDEX event_responses_option_id_idx ON public.event_responses USING btree (option_id);

CREATE INDEX events_community_id_idx ON public.events USING btree (community_id);

CREATE INDEX interactions_user_b_occurred_at_idx ON public.interactions USING btree (user_b, occurred_at DESC);

CREATE INDEX interactions_user_a_occurred_at_idx ON public.interactions USING btree (user_a, occurred_at DESC);

CREATE INDEX memberships_user_id_idx ON public.memberships USING btree (user_id);

CREATE INDEX memberships_community_id_idx ON public.memberships USING btree (community_id);

CREATE INDEX post_reactions_post_id_created_at_idx ON public.post_reactions USING btree (post_id, created_at DESC);

CREATE INDEX posts_community_id_created_at_idx ON public.posts USING btree (community_id, created_at DESC);

CREATE INDEX posts_author_id_created_at_idx ON public.posts USING btree (author_id, created_at DESC);

CREATE INDEX recovery_codes_target_user_idx ON public.recovery_codes USING btree (target_user);

CREATE INDEX recovery_contacts_user_id_idx ON public.recovery_contacts USING btree (user_id);

CREATE INDEX recovery_requests_community_status_idx ON public.recovery_requests USING btree (community_id, status);

CREATE INDEX time_capsules_community_id_open_at_idx ON public.time_capsules USING btree (community_id, open_at);

-- ------------------------------------------------------------
--  関数
--  テーブルの後に作ります。中でテーブルを見ているためです。
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.capsule_is_open(target_capsule uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from time_capsules
    where id = target_capsule
      and open_at <= now()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.check_recovery_threshold()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  approval_count int;
begin
  select count(*) into approval_count
    from recovery_approvals where request_id = new.request_id;

  if approval_count >= 3 then
    update recovery_requests set status = 'approved'
      where id = new.request_id and status = 'pending';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '名前未設定'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_member(target_community uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from memberships
    where user_id = auth.uid()
      and community_id = target_community
  );
$function$
;

CREATE OR REPLACE FUNCTION public.join_community(code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  target uuid;
begin
  -- コードでコミュニティを探す
  select id into target from communities where invite_code = code;

  if target is null then
    raise exception 'コードが見つかりません';
  end if;

  -- 自分の参加行を入れる。既にあれば何もしない
  insert into memberships (user_id, community_id)
  values (auth.uid(), target)
  on conflict do nothing;

  return target;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recovery_is_unlocked(request uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from recovery_requests r
    where r.id = request
      and r.status = 'pending'
      and r.requested_at + interval '24 hours' <= now()
      and not exists (
        select 1 from recovery_vetoes v where v.request_id = r.id
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.reject_recovery_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update recovery_requests
    set status = 'rejected'
    where id = new.request_id;
  return new;
end;
$function$
;

-- ------------------------------------------------------------
--  RLS を入れる
--  これを入れたテーブルは、下の「決まり」で許した行しか見えません。
-- ------------------------------------------------------------

alter table card_sends enable row level security;

alter table card_templates enable row level security;

alter table communities enable row level security;

alter table event_date_options enable row level security;

alter table event_responses enable row level security;

alter table events enable row level security;

alter table interactions enable row level security;

alter table memberships enable row level security;

alter table messages enable row level security;

alter table post_reactions enable row level security;

alter table posts enable row level security;

alter table profiles enable row level security;

alter table recovery_approvals enable row level security;

alter table recovery_codes enable row level security;

alter table recovery_contacts enable row level security;

alter table recovery_requests enable row level security;

alter table recovery_vetoes enable row level security;

alter table time_capsules enable row level security;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

-- ------------------------------------------------------------
--  決まり（誰に何を見せるか）
--  is_member などの関数を使うので、関数の後に作ります。
-- ------------------------------------------------------------

create policy "cards visible to both"
  on card_sends for select
  using (((from_user = auth.uid()) OR (to_user = auth.uid())));

create policy "cards insert"
  on card_sends for insert
  with check (((from_user = auth.uid()) AND is_member(community_id)));

create policy "templates insert"
  on card_templates for insert
  with check ((created_by = auth.uid()));

create policy "templates readable"
  on card_templates for select
  using (true);

create policy "communities update by owner"
  on communities for update
  using ((created_by = auth.uid()));

create policy "communities create"
  on communities for insert
  with check ((created_by = auth.uid()));

create policy "communities for members"
  on communities for select
  using (is_member(id));

create policy "Enable read access for all users"
  on event_date_options for select
  using (true);

create policy "date options delete by event owner"
  on event_date_options for delete
  using ((EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = event_date_options.event_id) AND (e.created_by = auth.uid())))));

create policy "date options visible"
  on event_date_options for select
  using (is_member(community_id));

create policy "date options insert"
  on event_date_options for insert
  with check (is_member(community_id));

create policy "responses insert own"
  on event_responses for insert
  with check (((user_id = auth.uid()) AND is_member(community_id)));

create policy "responses delete own"
  on event_responses for delete
  using ((user_id = auth.uid()));

create policy "responses update own"
  on event_responses for update
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));

create policy "responses visible"
  on event_responses for select
  using (is_member(community_id));

create policy "allow all"
  on event_responses for all
  using (true)
  with check (true);

create policy "events update by owner"
  on events for update
  using ((created_by = auth.uid()));

create policy "events visible"
  on events for select
  using ((is_member(community_id) AND (capsule_is_open(capsule_id) OR (created_by = auth.uid()))));

create policy "Enable read access for all users"
  on events for select
  using (true);

create policy "events insert"
  on events for insert
  with check (((created_by = auth.uid()) AND is_member(community_id)));

create policy "interactions insert"
  on interactions for insert
  with check (((user_a = auth.uid()) OR (user_b = auth.uid())));

create policy "interactions visible"
  on interactions for select
  using (((user_a = auth.uid()) OR (user_b = auth.uid())));

create policy "memberships leave"
  on memberships for delete
  using ((user_id = auth.uid()));

create policy "memberships join"
  on memberships for insert
  with check ((user_id = auth.uid()));

create policy "memberships visible"
  on memberships for select
  using (((user_id = auth.uid()) OR is_member(community_id)));

create policy "reactions insert"
  on post_reactions for insert
  with check (((from_user = auth.uid()) AND is_member(community_id)));

create policy "reactions for members"
  on post_reactions for select
  using (is_member(community_id));

create policy "posts update own"
  on posts for update
  using ((author_id = auth.uid()));

create policy "posts for members"
  on posts for select
  using (is_member(community_id));

create policy "posts insert"
  on posts for insert
  with check (((author_id = auth.uid()) AND is_member(community_id)));

create policy "自分のプロフィールだけ更新できる"
  on profiles for update
  using ((auth.uid() = id))
  with check ((auth.uid() = id));

create policy "profiles readable"
  on profiles for select
  using (true);

create policy "profiles self insert"
  on profiles for insert
  with check ((id = auth.uid()));

create policy "approvals insert"
  on recovery_approvals for insert
  with check ((approver_id = auth.uid()));

create policy "approvals visible"
  on recovery_approvals for select
  using (true);

create policy "同じコミュニティの人だけ発行できる"
  on recovery_codes for insert
  with check (((auth.uid() = issued_by) AND (EXISTS ( SELECT 1
   FROM (memberships mine
     JOIN memberships theirs ON ((theirs.community_id = mine.community_id)))
  WHERE ((mine.user_id = auth.uid()) AND (theirs.user_id = recovery_codes.target_user))))));

create policy "自分が発行したコードは消せる"
  on recovery_codes for delete
  using ((auth.uid() = issued_by));

create policy "自分が発行したコードだけ読める"
  on recovery_codes for select
  using ((auth.uid() = issued_by));

create policy "contacts own only"
  on recovery_contacts for all
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));

create policy "同じコミュニティの人は申請を読める"
  on recovery_requests for select
  using (is_member(community_id));

create policy "同じコミュニティの人は拒否を読める"
  on recovery_vetoes for select
  using ((EXISTS ( SELECT 1
   FROM recovery_requests r
  WHERE ((r.id = recovery_vetoes.request_id) AND is_member(r.community_id)))));

create policy "同じコミュニティの人は拒否できる"
  on recovery_vetoes for insert
  with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM recovery_requests r
  WHERE ((r.id = recovery_vetoes.request_id) AND is_member(r.community_id) AND (r.status = 'pending'::recovery_status))))));

create policy "capsules only after open"
  on time_capsules for select
  using ((is_member(community_id) AND (open_at <= now()) AND ((to_user IS NULL) OR (to_user = auth.uid()) OR (author_id = auth.uid()))));

create policy "capsules author sees own"
  on time_capsules for select
  using ((author_id = auth.uid()));

create policy "capsules insert"
  on time_capsules for insert
  with check (((author_id = auth.uid()) AND is_member(community_id)));

-- ------------------------------------------------------------
--  ビュー（別の表から作った見え方）
-- ------------------------------------------------------------

create or replace view last_contacts as
 SELECT interactions.user_a AS me,
    interactions.user_b AS partner,
    max(interactions.occurred_at) AS last_at
   FROM interactions
  GROUP BY interactions.user_a, interactions.user_b
UNION ALL
 SELECT interactions.user_b AS me,
    interactions.user_a AS partner,
    max(interactions.occurred_at) AS last_at
   FROM interactions
  GROUP BY interactions.user_b, interactions.user_a;

-- ------------------------------------------------------------
--  トリガー（何かが起きたときに自動で動くもの）
-- ------------------------------------------------------------

CREATE TRIGGER on_recovery_approved AFTER INSERT ON public.recovery_approvals FOR EACH ROW EXECUTE FUNCTION check_recovery_threshold();

CREATE TRIGGER on_recovery_veto AFTER INSERT ON public.recovery_vetoes FOR EACH ROW EXECUTE FUNCTION reject_recovery_request();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ------------------------------------------------------------
--  DB全体にかかるトリガー
-- ------------------------------------------------------------

drop event trigger if exists ensure_rls;

create event trigger ensure_rls on ddl_command_end
  execute function rls_auto_enable();
