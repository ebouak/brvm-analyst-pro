-- 0220 — Offres alignées sur ce que le site débloque réellement (2026-11-13).
--
-- Décisions de l'exploitant :
--   * Platinium RETIRÉ DE LA VENTE. Il n'ouvrait aucune fonction de plus que
--     Premium (aucun drapeau au niveau « pro ») et promettait une « gestion
--     assistée » qui pouvait passer pour du conseil en investissement. Les
--     abonnements en cours ne sont PAS touchés : leurs droits viennent de
--     l'abonnement actif et de profiles.is_premium, pas de is_active. Les trois
--     parcours de paiement refusent désormais un plan inactif.
--   * Alertes de cours : réservées au Premium. quota_free passe à 0 (il valait 1
--     sans être appliqué). Le moteur (scraper/runAlerts) n'évalue plus que les
--     alertes des comptes autorisés ; les alertes existantes restent en base.
--   * Paper trading : gratuit (drapeau déjà « free » ; la page sort du verrou
--     d'adresse /premium/* dans le code).
--
-- Aucune donnée personnelle modifiée. Réversible depuis /admin/features et
-- par un `update subscription_plans set is_active = true`.

update public.subscription_plans set is_active = false where code = 'platinium';

update public.feature_flags set quota_free = 0, updated_at = now() where code = 'alertes';

update public.feature_flags set acces = 'free', updated_at = now() where code = 'paper_trading' and acces <> 'free';
