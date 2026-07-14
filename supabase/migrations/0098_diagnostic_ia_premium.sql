-- 0098 — Diagnostic IA : premium, avec un levier marketing qui FONCTIONNE.
--
-- 1) `diagnostic_ia` était en `free` en base. Il brûle des tokens LLM à chaque
--    appel : il doit être premium.
--
-- 2) LE PIÈGE, et la raison d'être de ce fichier :
--    le jour où l'on rebascule la fonctionnalité en « Gratuit » depuis
--    /admin/features pour une campagne, RIEN ne se débloque si `quota_free = 0`.
--    Dans `featureGate.ts`, un quota à 0 renvoie un 403 (« pas inclus dans votre
--    formule ») — même quand l'accès est marqué `free`. On croirait avoir ouvert
--    la vanne ; elle resterait fermée, sans message d'erreur explicite.
--
--    On pose donc `quota_free = 1` : un diagnostic gratuit par jour et par
--    utilisateur. Cette valeur reste SANS EFFET tant que l'accès est `premium`
--    (les abonnés consomment `quota_premium`). Elle ne s'active que le jour où
--    l'on bascule en gratuit — et alors la campagne fonctionne vraiment, tout en
--    plafonnant la facture LLM.

update public.feature_flags
   set acces         = 'premium',
       quota_free    = 1,    -- levier marketing : actif seulement si acces='free'
       quota_premium = 10,   -- 10 diagnostics/jour pour un abonné
       description   = 'Analyse sell-side générée par LLM. Coût réel en tokens : quota par jour et par utilisateur. '
                       || 'Pour une campagne : basculer l''accès sur « Gratuit » — chaque compte gratuit aura alors '
                       || '1 diagnostic par jour (quota_free).',
       updated_at    = now()
 where code = 'diagnostic_ia';

-- Contrôle
select code, label, acces, quota_free, quota_premium
  from public.feature_flags
 where code = 'diagnostic_ia';
