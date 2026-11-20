-- 0254 — Relances du soir de la collecte de clôture (décision de l'exploitant, 2026-11-20).
--
-- Premier soir réel de 0252 (2026-11-20) : BDFIN affichait encore la séance de la
-- veille à 15:20, 15:50 et 16:30 UTC, puis la séance du jour à 17:30. Les 05/11 et
-- 17/11, BDFIN est resté en retard toute la soirée : sans relance après 17:30, ces
-- jours-là n'auraient aucune publication. On ajoute 18:30, 19:30 et 20:30 UTC.
--
-- Rien ne change sur le principe : `dispatch_cloture_si_necessaire()` (0252) ne
-- déclenche rien si la clôture est déjà confirmée, un jour fermé, ou si un run est
-- déjà en cours ; et la publication reste verrouillée par `cloture_confirmee`.
-- La veille de 23:00 (publication-veille.yml) continue de signaler un soir sans
-- publication.

do $$
begin
  perform cron.unschedule('cloture-dispatch-soir');
exception when others then null;
end $$;

-- 18:30, 19:30 et 20:30, jours ouvrés
select cron.schedule(
  'cloture-dispatch-soir',
  '30 18,19,20 * * 1-5',
  $$select public.dispatch_cloture_si_necessaire();$$
);

-- Vérification : select jobname, schedule, active from cron.job where jobname like 'cloture-dispatch%';
