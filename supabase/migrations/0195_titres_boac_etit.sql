-- 0195 — Nombre de titres de BOAC et ETIT, confirmé par l'exploitant le 2026-11-06
-- sur la fiche société Sika Finance.
--
-- BOAC : 60 000 000 saisis à la main, 40 000 000 publiés. 35,54 Md ÷ 40 M redonne
-- exactement le BPA publié (888,5). La capitalisation affichée était gonflée de 50 %.
-- ETIT : 24 730 539 065 saisis à la main, 18 084 106 722 publiés.
--
-- Conditionné à l'ancienne valeur : une correction faite entre-temps n'est pas écrasée.

update public.brvm_instruments
set shares = 40000000, shares_source = 'sikafinance (confirmé le 2026-11-06)'
where code = 'BOAC' and shares = 60000000;

update public.brvm_instruments
set shares = 18084106722, shares_source = 'sikafinance (confirmé le 2026-11-06)'
where code = 'ETIT' and shares = 24730539065;
