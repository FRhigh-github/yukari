-- ============================================================
--  誕生日の年を、いつも2000年にそろえる
--
--  画面は月と日だけを聞き、年は2000年と決めて入れています（components/BirthdayPicker.tsx）。
--  この作りになる前に登録した人の分には、本当の生まれ年が入っているかもしれません。
--  生まれ年は人に知られたくない情報なので、2000年に置き換え、これからも2000年しか入らないようにします。
--  （2000年はうるう年なので、2月29日生まれの人もそのまま入ります）
-- ============================================================

update public.profiles
  set birthday = make_date(2000, extract(month from birthday)::int, extract(day from birthday)::int)
  where birthday is not null and extract(year from birthday) <> 2000;

alter table public.profiles
  add constraint profiles_birthday_year check (extract(year from birthday) = 2000);
