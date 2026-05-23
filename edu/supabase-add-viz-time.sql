-- =============================================================
-- One-time migration: wc_visualization_messages.gift_minutes
--
-- Mirrors the gift_money column: lets a teacher send screen-time
-- minutes alongside a reply to a "이 단어를 듣거나 써봤다면 적어줘"
-- visualization message. When the student next polls and sees a
-- reply with gift_minutes > 0, sidebar.js writes an 'earn' row to
-- wc_time_entries (memo "선생님 보너스 시간") so the home ⏰ popup's
-- weekly graph picks it up automatically.
--
-- Safe to re-run.
-- =============================================================

alter table wc_visualization_messages
  add column if not exists gift_minutes int default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'wc_viz_gift_minutes_nonneg'
  ) then
    alter table wc_visualization_messages
      add constraint wc_viz_gift_minutes_nonneg
      check (gift_minutes is null or gift_minutes >= 0);
  end if;
end$$;

comment on column wc_visualization_messages.gift_minutes is
  'Optional rest-time minutes the teacher attached to this reply. The student credits these to wc_time_entries when sidebar.js sees the reply.';
