-- ============================================================
--  ゆかり / まっさらにする（危険）
--
--  アプリのテーブル・関数・許可と、すべてのアカウントを消します。
--  そのあと 01_schema.sql → 02_seed.sql の順に流すと、作り直せます。
--
--  ▼ 消えるもの
--    ・public にあるアプリのテーブル（中身ごと）・ビュー・関数・選択肢（enum）
--    ・すべてのアカウント（auth.users）。全員サインアップからやり直しです
--    ・保管庫（storage.objects）の許可
--
--  ▼ 消えないもの
--    ・保管庫に置いた写真のファイルそのもの。
--      Supabase では SQL から写真を消せないので、消したいときは
--      ダッシュボードの Storage で、各バケットの中身を選んで消してください
--      （残っていても、アプリからは見えないので害はありません）
--
--  ▼ なぜ「スキーマごと消す（drop schema public cascade）」にしないのか
--    public には Supabase が自分で置いた関数が入っていることがあり、
--    それは私たちの権限では消せません。1つでも消せないと全体が止まるので、
--    アプリが作ったものだけを、名前を並べて消しています。
--
--  何度流しても同じ結果になります（無いものは飛ばします）。
-- ============================================================

-- ------------------------------------------------------------
--  1. 保管庫の許可を全部消します
--     01_schema.sql で、正しいものだけを作り直します
-- ------------------------------------------------------------
do $$
declare
  p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

-- ------------------------------------------------------------
--  2. アカウントができたときに動く仕掛けを外します
--     （これが残っていると、下で関数を消したあと、サインアップが止まります）
-- ------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

-- ------------------------------------------------------------
--  3. ビューとテーブル
--     cascade = ぶら下がっている許可・索引・トリガーも一緒に消す
-- ------------------------------------------------------------
drop view if exists public.last_contacts cascade;

drop table if exists
  public.messages,
  public.event_responses,
  public.event_date_options,
  public.events,
  public.time_capsules,
  public.interactions,
  public.card_sends,
  public.card_templates,
  public.post_reactions,
  public.posts,
  public.recovery_vetoes,
  public.recovery_approvals,
  public.recovery_requests,
  public.recovery_codes,
  public.recovery_contacts,
  public.memberships,
  public.communities,
  public.profiles
cascade;

-- ------------------------------------------------------------
--  4. 関数（古い版で作ったものも含めて、全部の名前を並べています）
-- ------------------------------------------------------------
drop function if exists
  public.capsule_is_open(uuid),
  public.check_recovery_threshold(),
  public.create_community(text, text),
  public.handle_new_user(),
  public.is_demo_guest(),
  public.is_member(uuid),
  public.join_community(text),
  public.record_card_interaction(),
  public.record_message_interaction(),
  public.record_reaction_interaction(),
  public.recovery_is_unlocked(uuid),
  public.reject_recovery_request(),
  public.rename_community(uuid, text),
  public.set_community_icon(uuid, text),
  public.shares_community(uuid)
cascade;

-- ------------------------------------------------------------
--  5. 決まった選択肢（enum）
-- ------------------------------------------------------------
drop type if exists
  public.attendance,
  public.card_kind,
  public.contact_type,
  public.interaction_kind,
  public.member_role,
  public.recovery_status,
  public.user_status
cascade;

-- ------------------------------------------------------------
--  6. すべてのアカウント
-- ------------------------------------------------------------
delete from auth.users;
