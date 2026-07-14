-- 0103 — Indicateurs techniques de la fiche action réservés au premium.
--
-- Concerne la section « Indicateurs historiques » de /actions/[code] : graphiques
-- RSI (14) et MACD (12, 26, 9), lecture technique (haussière / baissière /
-- neutre) et les boutons d'explication par l'IA.
--
-- Le COURS et le VOLUME restent publics : c'est l'analyse qui est payante, pas
-- la donnée brute. Cohérent avec /actions, où seules les colonnes calculées
-- (Tendance 30 j, Signal) sont sous flag.
--
-- Réversible en un clic depuis /admin/features — y compris en « Gratuit » pour
-- une opération marketing.

insert into public.feature_flags (code, label, acces, description) values
  ('indicateurs_techniques', 'Indicateurs techniques (fiche action)', 'premium',
   'RSI, MACD, moyennes mobiles, lecture technique et explication IA sur /actions/[code]. Le cours et le volume restent publics.')
on conflict (code) do nothing;

-- Contrôle
select code, label, acces from public.feature_flags order by acces, code;
