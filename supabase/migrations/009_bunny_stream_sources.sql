-- Secure Bunny Stream support for lecture playback.
-- Keeps all existing YouTube and Supabase-storage lecture sources working.

begin;

alter table public.lecture_video_sources
  drop constraint if exists lecture_video_sources_provider_check,
  drop constraint if exists lecture_video_sources_provider_video_id_check;

alter table public.lecture_video_sources
  add constraint lecture_video_sources_provider_check
    check (provider in ('youtube', 'bunny')),
  add constraint lecture_video_sources_provider_video_id_check
    check (
      (provider = 'youtube' and provider_video_id ~ '^[A-Za-z0-9_-]{11}$')
      or
      (provider = 'bunny' and provider_video_id ~ '^[A-Fa-f0-9-]{32,40}$')
    );

comment on column public.lecture_video_sources.provider is
'External video provider. youtube keeps legacy playback; bunny uses server-signed Bunny Stream embeds.';

comment on column public.lecture_video_sources.provider_video_id is
'Provider-specific ID only. Secrets and signed Bunny playback URLs are never stored here.';

commit;
