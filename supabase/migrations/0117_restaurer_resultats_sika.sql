-- 0117 — Restaure les résultats nets CIEC et SHEC écrasés par une ré-extraction.
--
-- Une ré-extraction PDF du 2026-07-23 avait aligné income_statements sur les
-- valeurs du tableau de flux, alors que c'était income_statements qui était juste :
-- le contrôle Sika (48 sociétés, scripts/verify-sika.ts) l'a immédiatement signalé.
-- Les valeurs restaurées sont celles d'avant la ré-extraction, confirmées par Sika.
--
-- LEÇON : ne jamais laisser une ré-extraction LLM écraser une valeur déjà validée
-- sans contrôle externe. Le PDF déposé livre parfois les comptes sociaux là où la
-- base porte les consolidés (même cause que le cas CFAC, évité de justesse).
--
-- Idempotence : chaque update ne cible que la valeur fautive exacte.

update public.income_statements set resultat_net = 9819000000
  where code='CIEC' and periode='2022' and type_periode='annuel' and resultat_net = 10261000000;
update public.income_statements set resultat_net = 10633000000
  where code='CIEC' and periode='2023' and type_periode='annuel' and resultat_net = 11485000000;
update public.income_statements set resultat_net = 10101000000
  where code='CIEC' and periode='2024' and type_periode='annuel' and resultat_net = 10555000000;
update public.income_statements set resultat_net = 3753000000
  where code='SHEC' and periode='2022' and type_periode='annuel' and resultat_net = 3548638458;

-- fundamentals porte une copie du résultat net : la maintenir cohérente.
update public.fundamentals set net_income = 9819000000
  where code='CIEC' and year=2022 and net_income = 10261000000;
update public.fundamentals set net_income = 10633000000
  where code='CIEC' and year=2023 and net_income = 11485000000;
update public.fundamentals set net_income = 10101000000
  where code='CIEC' and year=2024 and net_income = 10555000000;
update public.fundamentals set net_income = 3753000000
  where code='SHEC' and year=2022 and net_income = 3548638458;
