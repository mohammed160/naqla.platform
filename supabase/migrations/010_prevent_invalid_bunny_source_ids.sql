begin;

alter table public.lecture_video_sources
  drop constraint if exists lecture_video_sources_bunny_video_not_lecture_id;

alter table public.lecture_video_sources
  add constraint lecture_video_sources_bunny_video_not_lecture_id
  check (
    provider <> 'bunny'
    or provider_video_id <> lecture_id::text
  ) not valid;

comment on constraint lecture_video_sources_bunny_video_not_lecture_id
on public.lecture_video_sources is
'Prevents accidentally storing a Supabase lecture UUID as the Bunny Stream video UUID. Existing rows can be repaired before validating the constraint.';

commit;
