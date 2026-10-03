-- ============================================================
--  長すぎる文字を入れられないようにする
--
--  前は、ご報告の本文・手紙の本文・出欠のひとこと・カードの配置の記録に上限が無く、
--  プログラムから何MBもの文字を入れられました。
--  01_schema.sql の check と同じ上限です。
--
--  not valid = 「これから入れる行」だけを確かめます。
--  すでに入っている行に長いものがあっても、流すのが止まらないようにするためです
-- ============================================================

alter table public.posts
  add constraint posts_body_length check (char_length(body) <= 2000) not valid;
alter table public.time_capsules
  add constraint time_capsules_body_length check (char_length(body) <= 10000) not valid;
alter table public.event_responses
  add constraint event_responses_comment_length check (char_length(comment) <= 200) not valid;
alter table public.card_sends
  add constraint card_sends_drawing_data_size check (pg_column_size(drawing_data) <= 102400) not valid;
