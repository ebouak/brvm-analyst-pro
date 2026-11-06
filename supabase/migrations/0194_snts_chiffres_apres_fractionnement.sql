-- 0194 — SNTS : trois chiffres non conformes, relevés le 2026-11-06 contre Sika
-- Finance après le fractionnement 1→10 du 26/10/2026.
--
-- Dividendes : 2024 et 2023 portaient l'arrondi 166 et 158. Les valeurs ajustées
-- sont 165,50 et 157,50 (Sika Finance et income_statements concordent). Le
-- dedupe_hash est recalculé selon runDividends.ts (code|exercice|montant) : sinon
-- la prochaine collecte verrait un montant nouveau et créerait un doublon.
--
-- Flottant : 23 877 452 titres, soit 2,4 % du capital, est la valeur d'avant le
-- fractionnement. Sika publie 22,47 % de 1 000 000 000 de titres.

update public.dividends
set montant = 165.5,
    dedupe_hash = encode(sha256(convert_to('SNTS|2024|165.5', 'UTF8')), 'hex')
where code = 'SNTS' and exercice = 2024 and montant = 166;

update public.dividends
set montant = 157.5,
    dedupe_hash = encode(sha256(convert_to('SNTS|2023|157.5', 'UTF8')), 'hex')
where code = 'SNTS' and exercice = 2023 and montant = 158;

update public.brvm_instruments
set flottant = 224700000
where code = 'SNTS' and flottant = 23877452;
