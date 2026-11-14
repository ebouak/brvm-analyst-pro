-- 0215 — Dossiers valeur et Revues de résultats réservés au plan Premium.
--
-- Le niveau d'accès vit en base (feature_flags) et s'édite dans /admin/features :
-- aucune page ne décide « ceci est premium ». Ces deux codes n'étaient pas
-- déclarés ; le filet de lib/server/featureAccess.ts les aurait traités en
-- premium, mais invisibles et non réglables depuis la console.
--
-- Aucune donnée personnelle : catalogue de fonctionnalités, RLS déjà posée en 0091.
-- Idempotent : une ligne déjà réglée depuis la console n'est pas écrasée.

insert into public.feature_flags (code, label, acces, description) values
  ('dossiers_valeur', 'Dossiers valeur', 'premium',
   'Lecture d''un dossier valeur (/rapports/dossier/[code]) et téléchargement de son PDF. La liste /rapports/dossiers reste ouverte à tout compte. Le robot d''impression du samedi passe par son secret, indépendamment de ce réglage.'),
  ('revues_resultats', 'Revues de résultats', 'premium',
   'Liste /rapports/revues et page /actions/[code]/revue.')
on conflict (code) do nothing;
