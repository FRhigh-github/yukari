-- コミュニティのアイコン画像を入れる列を足します。
--
-- 画面の一番上のバーで、いま見ているコミュニティを表す絵として使います。
-- 入っていないとき（null）は、そのコミュニティの人の顔を3枚重ねて出します。
--
-- ▼ すでに動いているデータベースに、あとから足すためのファイルです。
--   まっさらから作る人は 01_schema.sql にも同じ列が入っているので、
--   こちらを流す必要はありません。
--
-- if not exists = もう足してあるときは何もしません。
-- 2回流してしまっても壊れないようにするための書き方です。
alter table communities add column if not exists icon_url text;

-- ▼ 誰が変えられるか、は足さなくて大丈夫です。
--   communities の「書き換え」は、すでに作った人だけに絞られています。
--     create policy "communities update by owner"
--       on communities for update using (created_by = auth.uid());
--   列を足しても、この決まりがそのまま効きます。


-- ▼ アイコンだけは、そのコミュニティの人なら誰でも変えられるようにします。
--
--   ここで困るのは、RLS が「行」の単位でしか効かないことです。
--   「メンバーなら communities を書き換えてよい」と書いてしまうと、
--   名前も招待コードも一緒に変えられるようになってしまいます。
--
--   そこで、アイコンだけを変える関数を用意しました。
--   security definer = 呼んだ人ではなく、この関数を作った人の権限で動きます。
--   つまり RLS を通り抜けられるので、中で自分で条件を確かめます。
create or replace function public.set_community_icon(
  target_community uuid,
  url text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- そのコミュニティの人かどうかを、ここで確かめます。
  -- ここを書き忘れると、誰でも他人のコミュニティの絵を差し替えられます。
  if not is_member(target_community) then
    raise exception 'このコミュニティのメンバーではありません';
  end if;

  update communities set icon_url = url where id = target_community;
end;
$$;
