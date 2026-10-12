-- 0151 — Dette financière vérifiée sur les états financiers publiés (2026-10-12).
--
-- POURQUOI. fundamentals.debt ne recevait que la dette à LONG terme
-- (frontend/lib/import/fullPersist.ts, corrigé dans la même PR). SNTS 2025 :
-- 248 Md en base, 402,7 Md dans les comptes consolidés certifiés ; endettement
-- lu à 17,7 % au lieu de 28,8 %.
--
-- PÉRIMÈTRE. Seules les lignes VÉRIFIÉES une à une sur le PDF publié (BDFIN) :
-- emprunts + trésorerie-passif du document = long terme + court terme du bilan
-- en base. Écartées faute de preuve : ABJC, PRSC, SICC, SDSC (PDF scannés),
-- SCRC (comptes IFRS et SYSCOHADA divergents), SHEC 2022 (document rattaché
-- à AGL), SNTS 2023 et SLBC 2023 (une moitié seulement confirmée), banques
-- (leur court terme, ce sont les dépôts). PALC, référence « pdf-verified »,
-- n'est pas touchée ici.
--
-- IDEMPOTENT : chaque UPDATE ne s'applique que si l'ancienne valeur est en
-- base ; une seconde exécution ne change rien.
begin;
-- SNTS 2025 : 248.04 -> 402.69 Md. EF 2025 consolidés certifiés p.22 : passifs financiers non courants + courants
update fundamentals set debt = 402686000000, updated_at = now() where code = 'SNTS' and year = 2025 and debt = 248038000000;
-- UNLC 2023 : 4.38 -> 15.38 Md. EF 2023 : emprunts et dettes financières diverses + trésorerie-passif
update fundamentals set debt = 15384291641, updated_at = now() where code = 'UNLC' and year = 2023 and debt = 4379101937;
-- SLBC 2024 : 50.96 -> 69.79 Md. EF 2025 (colonnes 2024 | 2025) : dettes financières diverses + trésorerie-passif
update fundamentals set debt = 69793000000, updated_at = now() where code = 'SLBC' and year = 2024 and debt = 50961000000;
-- BNBC 2025 : 0.21 -> 18.74 Md. EF 2025 / 2022 : emprunts et dettes financières diverses + trésorerie passif
update fundamentals set debt = 18744381429, updated_at = now() where code = 'BNBC' and year = 2025 and debt = 209000000;
-- SLBC 2025 : 46.42 -> 46.80 Md. EF 2025 (colonnes 2024 | 2025) : dettes financières diverses + trésorerie-passif
update fundamentals set debt = 46799000000, updated_at = now() where code = 'SLBC' and year = 2025 and debt = 46424000000;
-- ORAC 2025 : 224.00 -> 335.90 Md. EF 2025 p.9 : passifs financiers non courants + courants
update fundamentals set debt = 335900000000, updated_at = now() where code = 'ORAC' and year = 2025 and debt = 224000000000;
-- BNBC 2022 : 1.48 -> 17.22 Md. EF 2025 / 2022 : emprunts et dettes financières diverses + trésorerie passif
update fundamentals set debt = 17217000000, updated_at = now() where code = 'BNBC' and year = 2022 and debt = 1477000000;
-- ORAC 2024 : 159.80 -> 335.80 Md. EF 2025 p.9 : passifs financiers non courants + courants
update fundamentals set debt = 335800000000, updated_at = now() where code = 'ORAC' and year = 2024 and debt = 159800000000;
-- SMBC 2023 : 2.37 -> 19.58 Md. EF 2023 : emprunts & dettes financières + trésorerie-passif
update fundamentals set debt = 19576000000, updated_at = now() where code = 'SMBC' and year = 2023 and debt = 2367000000;
-- SMBC 2022 : 3.22 -> 28.49 Md. EF 2023 : emprunts & dettes financières + trésorerie-passif
update fundamentals set debt = 28491000000, updated_at = now() where code = 'SMBC' and year = 2022 and debt = 3218000000;
-- SNTS 2024 : 241.47 -> 460.55 Md. EF 2025 consolidés certifiés p.22 : passifs financiers non courants + courants
update fundamentals set debt = 460549000000, updated_at = now() where code = 'SNTS' and year = 2024 and debt = 241468000000;
-- TTLC 2025 : 1.89 -> 32.66 Md. EF SYSCOHADA 2025 : emprunts à LT + trésorerie-passif
update fundamentals set debt = 32665000000, updated_at = now() where code = 'TTLC' and year = 2025 and debt = 1888000000;
commit;
