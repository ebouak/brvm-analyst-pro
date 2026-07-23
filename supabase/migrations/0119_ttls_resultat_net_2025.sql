-- 0119 — Corrige le résultat net TTLS 2025.
--
-- Deux sources indépendantes convergent contre notre valeur : Madis Invest
-- (6 146 M) et Sika Finance (6 147 M), contre 6 779 M en base. Le chiffre
-- d'affaires, lui, concorde exactement sur les cinq exercices (455 209 M en
-- 2025), ce qui isole l'erreur au seul résultat net.
--
-- L'exercice 2024 n'est PAS touché : Madis y donne 7 691 M contre 7 140 M en
-- base, mais c'est Madis qui est l'intrus. Le nombre d'actions implicite (RN/BPA)
-- ressort à ~32,58 M de façon stable de 2020 à 2024 ; 7 140/218 le confirme,
-- tandis que 7 691 imposerait un BPA de 236 incompatible avec le 218 publié.
-- Sika ne signale pas non plus 2024.

update public.income_statements set resultat_net = 6146000000
  where code='TTLS' and periode='2025' and type_periode='annuel' and resultat_net = 6779000000;

update public.fundamentals set net_income = 6146000000
  where code='TTLS' and year=2025 and net_income = 6779000000;
