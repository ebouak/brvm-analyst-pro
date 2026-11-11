-- 0213 — Audit F-04, étape 2 sur 2 (CONTRACTION). APPLIQUÉE le 2026-11-11.
--
-- Ne ferme que `advisor_history` (flag `conseiller` = Premium, aucun lecteur
-- côté frontend). Vérifié à la clé publique : lecture 0 ligne, écriture 401.
--
-- DÉCISION PRODUIT (2026-11-11, option A) : signals_daily,
-- technical_indicators, brvm_pattern_scores et brvm_intraday_patterns RESTENT
-- en lecture publique. Leurs flags (`signaux`, `actions_metrics`,
-- `indicateurs_techniques`, `screener_intraday`, `backtest`) sont « free »
-- depuis le 2026-07-15, et `canAccess` accorde « free » à TOUT visiteur, y
-- compris anonyme : /actions et /actions/[code] (publiques) les affichent
-- donc légitimement. Les fermer à l'anonyme viderait ces pages en silence.
-- ⚠️ Si l'un de ces flags repasse en « premium », la table correspondante
-- redevient une fuite par l'API REST : il faudra alors la fermer ici.

drop policy if exists "lecture publique advisor_history" on public.advisor_history;
create policy "lecture comptes advisor_history" on public.advisor_history
  for select to authenticated using (true);
