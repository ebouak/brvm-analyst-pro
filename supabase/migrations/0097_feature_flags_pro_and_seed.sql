-- 0097 — Pilotage des verrous premium depuis /admin/features.
--
-- POURQUOI : les verrous premium étaient CODÉS EN DUR dans chaque page. Rendre le
-- Screener gratuit pour une opération marketing imposait un redéploiement. Or la
-- table `feature_flags` et l'écran `/admin/features` existent déjà : il suffit d'y
-- brancher les verrous. Une case à cocher remplace un déploiement.
--
-- ⚠️ SANS CETTE MIGRATION, les fonctionnalités ci-dessous sont REFUSÉES à tout le
-- monde : le code refuse ce qui n'est pas déclaré (filet de sécurité — ouvrir par
-- défaut ferait fuir le revenu au premier incident, refuser est réversible).

-- ── 1. Nouveau niveau « pro » (plan Platinium) ──────────────────────────────
-- L'énumération n'acceptait que free/premium/disabled : impossible d'exprimer
-- « réservé au Platinium ».
alter table public.feature_flags
  drop constraint if exists feature_flags_acces_check;

alter table public.feature_flags
  add constraint feature_flags_acces_check
  check (acces in ('free', 'premium', 'pro', 'disabled'));

comment on column public.feature_flags.acces is
  'free = ouvert à tous · premium = abonnés Premium ou Platinium · pro = Platinium seulement · disabled = coupé pour tous (kill switch)';

-- ── 2. Déclaration des zones verrouillées ───────────────────────────────────
-- `on conflict do nothing` : on ne réécrit JAMAIS un réglage déjà choisi par un
-- administrateur. Une migration ne doit pas défaire un choix humain.
insert into public.feature_flags (code, label, acces, description) values
  ('conseiller',       'Conseiller',              'premium',
   'Recommandations achat / conservation / vente, argumentées.'),
  ('signaux',          'Signaux BUY/SELL',        'premium',
   'Signaux notés + performance historique. Page /signaux et section du dashboard.'),
  ('screener',         'Screener multi-critères', 'premium',
   'Filtrage des 47 valeurs par RSI, volume, score, secteur, dividende.'),
  ('screener_intraday','Screener intraday',       'premium',
   'Momentum et volumes anormaux détectés en séance.'),
  ('fondamentaux',     'Analyse fondamentale',    'premium',
   'PER, P/B, ROE, rendement du dividende, comparateur sectoriel.'),
  ('alertes',          'Alertes personnalisées',  'premium',
   'Notifications email / WhatsApp au franchissement d''un seuil.'),
  ('formations',       'Formations & conférences','pro',
   'Académie WESTBOURSE : cours, webinaires, conférences. Réservé au Platinium.'),
  ('saisonnalite',     'Saisonnalité',            'premium',
   'Matrice mensuelle. En gratuit : aperçu du mois en cours sur un seul titre.'),
  ('actions_metrics',  'Métriques & signaux actions', 'premium',
   'Colonnes calculées de la page /actions : tendance 30 j et signal. Les cours restent publics.')
on conflict (code) do nothing;

-- ── 3. Backtest : 'free' → 'premium' ────────────────────────────────────────
-- `backtest` EXISTE DÉJÀ (seed de la migration 0091, accès 'free'). Le `on conflict
-- do nothing` ci-dessus ne l'aurait donc pas touché, et le Backtest serait resté
-- gratuit — alors que l'onglet Analyse doit être premium dans son ensemble.
-- On le bascule explicitement. Réversible depuis /admin/features en un clic.
update public.feature_flags
   set acces = 'premium',
       label = 'Backtest de stratégie',
       description = 'Simulation d''une stratégie sur l''historique BRVM : rendement, drawdown, comparaison au marché.',
       updated_at = now()
 where code = 'backtest'
   and acces = 'free';   -- garde-fou : si un admin l'a déjà réglé autrement, on n'y touche pas

-- ── Contrôle ────────────────────────────────────────────────────────────────
-- Après exécution, vérifier que les 10 fonctionnalités apparaissent bien :
--   select code, label, acces from public.feature_flags order by acces, code;
