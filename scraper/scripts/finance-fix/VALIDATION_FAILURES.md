# Entités bloquées — Incohérences détectées (validation pass)

## Critères d'incohérence

**Écart > ±5% OU bilan non reconcilié (actif ≠ passif ±2%) → BLOQUÉE avant extraction.**

---

## UNLC — ❌ BLOQUÉE

**Incohérences :**
- CA PDF 2023 : 34.68 Mds FCFA | MADIS : 71.54 Mds FCFA → **écart −52%** (hors tolérance)
- RN PDF 2023 : 0.64 Mds FCFA | MADIS : 6.29 Mds FCFA → **écart −90%** (critique)
- Total Actif : 55.77 Mds FCFA | Total Passif : 23.01 Mds FCFA → **bilan non reconcilié (ratio 2.4x)**

**Cause probable :**
- PDF téléchargé parle peut-être d'une entité distincte (filiale vs groupe)
- Ou MADIS parle d'une année différente / consolidation différente
- Ou URL scraping a récupéré le mauvais PDF

**Action :** Investiguer identité PDF (NCC 6900765) avant d'avancer. NE PAS extraire tant que discrepancy non expliquée.

---

## TTLC, CFAC, NTLC — EN COURS (validation pass à compléter)

Validation pass reste à compléter pour ces 3 sociétés avant de procéder.

---

**Résumé :** 1 entité bloquée (UNLC). À compléter pour 3 autres.
