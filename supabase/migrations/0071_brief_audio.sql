-- supabase/migrations/0071_brief_audio.sql
-- Brief quotidien en AUDIO (TTS) : colonne d'URL + bucket Storage public.
-- Le fichier MP3 est généré par le scraper (si clé TTS configurée) et servi
-- publiquement — même statut que le texte du brief (contenu public).

alter table public.brief_daily add column if not exists audio_url text;

comment on column public.brief_daily.audio_url is
  'URL publique du brief audio (MP3, TTS) — null si la génération audio n''est pas configurée.';

insert into storage.buckets (id, name, public)
values ('brief-audio', 'brief-audio', true)
on conflict (id) do nothing;

drop policy if exists "lecture publique brief-audio" on storage.objects;
create policy "lecture publique brief-audio"
  on storage.objects for select
  using (bucket_id = 'brief-audio');
