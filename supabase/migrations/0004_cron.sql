-- ============================================================================
-- BRVM Analyst Pro — Planification (cf. §7 / §11)
-- Option A : pg_cron déclenche une Edge Function "scrape-daily" via pg_net.
-- Option B (recommandée pour Node natif) : cron externe (GitHub Actions /
--           Vercel Cron) appelle le worker. Voir docs/DEPLOYMENT.md.
--
-- Ce fichier configure l'option A et le rafraîchissement des vues.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Rafraîchit les vues matérialisées chaque jour de semaine à 18h05 UTC
-- (après clôture BRVM, séance ~jusqu'à 16h GMT).
select cron.schedule(
  'refresh-market-views',
  '5 18 * * 1-5',
  $$ select public.refresh_market_views(); $$
);

-- Déclenche l'Edge Function de scraping à 18h00 UTC les jours de semaine.
-- Remplacer <PROJECT_REF> et stocker le secret d'invocation hors SQL.
-- (Le scraper Node peut aussi être appelé par un cron externe — préféré.)
select cron.schedule(
  'scrape-bdfin-daily',
  '0 18 * * 1-5',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/scrape-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.scrape_invoke_token', true)
    ),
    body    := jsonb_build_object('mode', 'daily')
  );
  $$
);

-- Pour lister / supprimer :
--   select * from cron.job;
--   select cron.unschedule('scrape-bdfin-daily');
