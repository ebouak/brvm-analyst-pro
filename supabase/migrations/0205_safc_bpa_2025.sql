-- 0205 — SAFC : BPA 2025 aligné sur la valeur publiée
--
-- Constat (2026-11-10). income_statements SAFC 2025 (annuel) : résultat net
-- 701 000 000, BPA stocké 86,33. Avec 11 869 750 titres, résultat ÷ titres =
-- 59,06, exactement le BNPA publié par la fiche société Sika Finance (résultat
-- 701 MFCFA, BNPA 59,06). 86,33 ne correspond à aucun résultat publié.
-- La fiche action recalculait déjà 59,06 ; la valeur stockée faussait le
-- diagnostic (valorisation.ts lit benefice_par_action en priorité) et les
-- exercices Academy (PER 46 % trop bas).
--
-- Conditionné à l'ancienne valeur : une relance ou une correction ultérieure
-- n'est pas écrasée.

update public.income_statements
set benefice_par_action = 59.06
where code = 'SAFC'
  and periode = '2025'
  and type_periode = 'annuel'
  and benefice_par_action = 86.33
  and resultat_net = 701000000;
