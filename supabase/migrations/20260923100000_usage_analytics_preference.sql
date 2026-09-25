-- Usage analytics is behavior-only and excludes financial content. Users can
-- disable collection from Settings; the durable account preference follows
-- them across devices.
alter table public.user_settings
  add column analytics_enabled boolean not null default true;

