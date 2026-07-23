-- 0118 — Corrige CA, BPA et dividende de CIEC (2022-2024) d'après la fiche
-- valeur Madis Invest, et renseigne le nombre d'actions.
--
-- Le BPA en base était incohérent : rapporté au résultat net il donnait 53,7 M
-- puis 51,9 M puis 53,7 M d'actions. La série Madis donne exactement 56 000 000
-- sur les quatre exercices (9 757/174,22 = 10 633/189,88 = 10 101/180,38), et ses
-- taux de croissance recalculent au centième près. C'est la série cohérente.
--
-- L'exercice 2021, antérieur aux ré-extractions du 2026-07-23, concordait déjà.
-- Le dividende 2022-2024 était absent : la fiche Madis le fournit.
--
-- RÉSERVE sur la source : cette fiche comporte deux erreurs manifestes ailleurs
-- dans le document — son paragraphe « Exercice 2024 » décrit CFAO Motors CI et
-- non la CIE, et son tableau semestriel affiche un résultat net S1-2025 de 2 096
-- incompatible avec la variation +13,37 % annoncée (le texte dit 5,1 Md). Seul
-- le TABLEAU ANNUEL, vérifié cohérent, est repris ici.

update public.income_statements set
  revenu_total = 238854000000, benefice_par_action = 175.34, dividende_par_action = 158
  where code='CIEC' and periode='2022' and type_periode='annuel';
update public.income_statements set
  revenu_total = 257218000000, benefice_par_action = 189.88, dividende_par_action = 171
  where code='CIEC' and periode='2023' and type_periode='annuel';
update public.income_statements set
  revenu_total = 263294000000, benefice_par_action = 180.38, dividende_par_action = 158.4
  where code='CIEC' and periode='2024' and type_periode='annuel';

update public.fundamentals set revenue = 238854000000 where code='CIEC' and year=2022;
update public.fundamentals set revenue = 257218000000 where code='CIEC' and year=2023;
update public.fundamentals set revenue = 263294000000 where code='CIEC' and year=2024;

-- Nombre d'actions déduit de façon stable de RN/BPA sur 4 exercices.
update public.brvm_instruments
  set shares = 56000000, shares_source = 'madis-fiche-valeur-2025'
  where code='CIEC' and (shares is null or shares <> 56000000);
