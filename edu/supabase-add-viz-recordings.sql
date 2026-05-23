-- =============================================================
-- One-time migration: wc_visualization_messages.recording_urls
--
-- When the student finishes recording every sentence on a page and
-- triggers the post-page flow (play-all → quiz → animal → wheel →
-- message popup), the popup sends a viz message AND attaches the
-- page's recording URLs (read from wc_recordings) so the teacher can
-- listen to the actual reading in the Messages tab.
--
-- Safe to re-run.
-- =============================================================

alter table wc_visualization_messages
  add column if not exists recording_urls text[];

comment on column wc_visualization_messages.recording_urls is
  'Public Storage URLs of the page recordings the student attached. Set by the post-recording message popup; teacher.js Messages renders an <audio controls> per URL.';
