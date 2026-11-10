-- 0204 — NEIC : chiffres par action faux (×25) sur les lignes « annual »
--
-- Constat (2026-11-10). income_statements porte, pour NEIC 2022-2025, deux lignes
-- par exercice : type_periode = 'annuel' (Sika, BPA juste) et 'annual' (import PDF
-- du 2026-06-28, seule occurrence de 'annual' de toute la table). Ces dernières
-- ont actions_en_circulation = 510 633, nombre de titres d'AVANT le fractionnement
-- 25 pour 1 du 9 août 2017 (12 765 825 titres aujourd'hui). D'où :
--   BPA 2025 stocké 3 989  = 2 036 626 234 ÷ 510 633 ; publié (Sika) 159,54
--   = 2 036 626 234 ÷ 12 765 825. Rapport 25,00 sur les quatre exercices.
-- Le dividende par action de ces lignes est faux aussi (2025 : 3 989, recopie du
-- BPA ; Sika et la ligne 'annuel' : 140,39).
--
-- Correctif MINIMAL : les trois colonnes par action, prouvées fausses, passent à
-- NULL. Les lignes 'annuel' portent déjà les bonnes valeurs ; les lignes 'annual'
-- gardent leurs postes détaillés (coût des ventes, marge, impôts…), qui ne sont
-- pas en cause. Rien n'est supprimé.
--
-- Hors de ce correctif, à trancher sur le PDF : le doublon annual/annuel lui-même
-- (lecteurs sans filtre de type_periode : quant, scoring) et les bilans NEIC
-- 2022-2024, présents seulement en 'annual' (total d'actif 2024 identique au
-- franc près à 2023).
--
-- Conditionné à la valeur fausse : une correction faite entre-temps n'est pas
-- écrasée, et une relance ne fait rien.

update public.income_statements
set benefice_par_action = null,
    dividende_par_action = null,
    actions_en_circulation = null
where code = 'NEIC'
  and type_periode = 'annual'
  and periode in ('2022', '2023', '2024', '2025')
  and actions_en_circulation = 510633;
