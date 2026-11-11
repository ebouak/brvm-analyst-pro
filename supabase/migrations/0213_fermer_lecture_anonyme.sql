-- 0213 — Audit F-04, étape 2 sur 2 (CONTRACTION).
--
-- ⚠️ À appliquer SEULEMENT après le déploiement en production du frontend
-- qui lit public.signaux_publics() (0212) sur les pages anonymes, et après
-- vérification à la clé publique. Sinon les pages publiques se vident en
-- silence (la RLS rend [] et non une erreur).
--
-- Ferme la lecture ANONYME des cinq tables d'analyse. Les comptes connectés
-- gardent la lecture (le mur Premium reste porté par les pages).
-- RISQUE RÉSIDUEL ACCEPTÉ : un compte gratuit peut encore lire ces tables
-- par l'API REST. Fermer au seul Premium exigerait de déplacer ~32 lecteurs
-- vers le serveur (option B de l'audit, non retenue à ce stade).
--
-- Les quatre tables de fondamentaux restent publiques : ce sont les fiches
-- SEO, tirées d'états financiers publiés.

drop policy if exists "lecture publique signaux" on public.signals_daily;
create policy "lecture comptes signaux" on public.signals_daily
  for select to authenticated using (true);

drop policy if exists "lecture publique advisor_history" on public.advisor_history;
create policy "lecture comptes advisor_history" on public.advisor_history
  for select to authenticated using (true);

drop policy if exists "lecture publique technical_indicators" on public.technical_indicators;
create policy "lecture comptes technical_indicators" on public.technical_indicators
  for select to authenticated using (true);

drop policy if exists "pattern_scores_public_read" on public.brvm_pattern_scores;
create policy "pattern_scores_lecture_comptes" on public.brvm_pattern_scores
  for select to authenticated using (true);

drop policy if exists "intraday_patterns_public_read" on public.brvm_intraday_patterns;
create policy "intraday_patterns_lecture_comptes" on public.brvm_intraday_patterns
  for select to authenticated using (true);
