-- ============================================================
--  宛先が特定の人の手紙では、日程調整とチャットも、その人と書いた人にしか見せない
--
--  前は「手紙の開封日が来ているか」だけを見ていたので、
--  宛先が特定の人の手紙でも、付いている日程調整（イベント名・候補日・出欠）と
--  チャットが、コミュニティの全員に見えていました。
--  01_schema.sql の capsule_is_visible と「events readable」と同じものです。
-- ============================================================

create function public.capsule_is_visible(target_capsule uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from time_capsules
    where id = target_capsule
      and (
        author_id = auth.uid()
        or (open_at <= now() and (to_user is null or to_user = auth.uid()))
      )
  );
$$;

revoke execute on function public.capsule_is_visible(uuid) from public, anon;
grant execute on function public.capsule_is_visible(uuid) to authenticated, service_role;

drop policy if exists "events readable" on public.events;
create policy "events readable"
  on public.events for select
  to authenticated
  using (
    is_member(community_id)
    and (capsule_is_visible(capsule_id) or created_by = auth.uid())
  );

drop function public.capsule_is_open(uuid);
