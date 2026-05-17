-- ============================================================
--  Add money-gift support to teacher → student message replies.
--
--  Background: wc_visualization_messages already lets a teacher
--  attach an animal sticker (gift_animal_set / gift_animal_index)
--  and a text response (teacher_response) to a student's message.
--  This migration adds gift_money so teachers can also reward a
--  good "Use it" answer with coins. When the student's sidebar
--  polls and sees a reply with gift_money > 0, it bumps the
--  student's wc_users.money field (same flow as encounter coins).
--
--  Safe to run multiple times — `add column if not exists`.
-- ============================================================
alter table wc_visualization_messages
  add column if not exists gift_money int default 0;

-- Quick consistency check: negative coin gifts make no sense.
-- (Keep as a sanity rail rather than a hard NOT NULL so old rows
-- without the column don't fail backfill.)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'wc_viz_gift_money_nonneg'
  ) then
    alter table wc_visualization_messages
      add constraint wc_viz_gift_money_nonneg
      check (gift_money is null or gift_money >= 0);
  end if;
end$$;
