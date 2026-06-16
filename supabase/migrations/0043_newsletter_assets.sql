-- supabase/migrations/0043_newsletter_assets.sql
-- Bucket public pour les images intégrées aux campagnes newsletter.
-- Lecture publique (les clients mail chargent les <img>), écriture service-role
-- uniquement (la service_role bypasse la RLS de storage.objects).
insert into storage.buckets (id, name, public)
values ('newsletter-assets', 'newsletter-assets', true)
on conflict (id) do nothing;
