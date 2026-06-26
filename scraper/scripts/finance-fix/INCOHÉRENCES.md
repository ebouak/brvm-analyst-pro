# Incohérences & Pièges identifiés — 13/13 sociétés (qualité données)

**Synthèse des garde-fous appliqués et leçons apprises lors de l'extraction audité SYSCOHADA 2020-2025.**

---

## Pièges par société

### Complétées (9/13) ✅

| Société | Piège | Garde-fou appliqué | Résultat |
|---------|-------|-------------------|----------|
| **BNBC** | (Première extraction, template établi) | Découverts dans passif_courant + dette_CT | ✅ Verts |
| **SPHC** | Bilan condensé (fournisseurs/dette_LT null) | Approx. reserves ; découverts inclus | ✅ Verts |
| **SCRC** | REX 2021 sign inversé (−) dans source | Vérifier signe avant calcul D&A | ✅ Verts |
| **SLBC** | D&A convention ambiguë (TAFIRE vs exploitation) | D&A = EBE − REX (net exploitation) | ✅ Verts |
| **PRSC** | Unités PDF mixtes (millions + FCFA) | Convertir à FCFA bruts ; actions 10 240 000 | ✅ Verts |
| **SMBC** | Synthèse condensés (qq lignes null) | Tolérer nulls, garder CA/RN certains | ✅ Verts |
| **SHEC** | TAFIRE → flux cash partiels (actions/BPA null) | Accepter nulls légitimes, pas inventer | ✅ Verts |
| **UNXC** | Structure data confuse (objects vs arrays) | Normaliser à arrays [{periode, ...}] | ✅ Verts |
| **ONTBF** | Découverts non inclus initialement dans passif | Ajouter tréso_passif dans passif_courant | ✅ Verts |

---

### En cours (4/13)

| Société | Piège | Garde-fou appliqué | État |
|---------|-------|-------------------|------|
| **UNLC** | Limité à 2023 (2024-25 non publiés) | Validation MADIS : CA 71 543 M, RN 6 287 M | Stub OK, attente extraction balance/cash |
| **TTLC** | Exos annuels vs semestriels sur site | Filtrer semestriels ; PDF 2025 "approuvés" | Stub OK, attente extraction 2025 |
| **CFAC** | **CRITIQUE : confusion CFAO vs TRACTAFRIC** | Vérifier en-tête PDF = "CFAO Motors/Mobility", non TRACTAFRIC | Stub OK, **vérification identité obligatoire** |
| **NTLC** | Layout compte résultat atypique ; 2024 obsolète | Lire REX/D&A/RN par logique, ignorer 2024 | Stub OK, attente extraction avec soin |

---

## Conventions établies (appliquées à tous)

### Découverts bancaires

**Règle :** Trésorerie Passif (découverts) **DOIT être incluse** dans `passif_courant` ET `dette_court_terme`.

**Formule :** 
- `passif_courant = TOTAL PASSIF CIRCULANT + TOTAL TRESORERIE PASSIF`
- `dette_court_terme = TOTAL TRESORERIE PASSIF`

**Raison :** SYSCOHADA : CP + PNC + PC = total_passif (±2%). Sans découverts, équation échoue.

### D&A (Depreciation & Amortissement)

**Règle :** D&A dans cash-flow = **REX + D&A = EBE** (net exploitation uniquement).

**Formule :** `depreciation_amortissement = EBE − resultat_exploitation` (NOT total TAFIRE D&A).

**Raison :** Évite double-compte des charges exceptionnelles.

### Unités (PDF → FCFA bruts)

**Lire en-tête PDF pour déterminer unité :** millions / milliers / FCFA bruts.

**Conversion :** 
- Millions FCFA → `* 1e6`
- Milliers FCFA → `* 1e3`
- FCFA bruts → pas de conversion

**Piège :** Mélanges d'unités dans le même PDF (ex: PRSC 2024-25 FCFA, 2023 millions).

### Actions en circulation & BPA

**Source :** Capital social / nominal (nominal rarement dans PDF → souvent null).

**Calcul :** `BPA = resultat_net / actions_en_circulation` (si actions_en_circulation available).

**Tolérance :** Si BPA null, ne pas inventer.

---

## Leçons : ordre extraction futur

**Ordre de difficulté recommandé (testée sur 9/13) :**

1. Sociétés simple (SPHC, SCRC) → établit template
2. Sociétés avec synthèse (SMBC, SHEC, UNXC) → tolère nulls
3. Sociétés pièges simples (PRSC, SLBC, ONTBF) → pièges isolés
4. Sociétés pièges complexes (NTLC, CFAC) → require soin final

**"Vérifier avant" workflow :**
1. Validation pass : CA + RN vs MADIS (tolérance ±5%)
2. Si écart > 5% ou identité douteuse → investiguer avant extraction complète
3. Extraction complète + guardrails
4. Committer avec notes sur écarts/pièges trouvés

---

## Récapitulatif garde-fous (générique)

Appliqué dans `lib.mjs:guardrails()` :

| Check | Tolérance | Raison |
|-------|-----------|--------|
| Actif = Passif | ±1% | Bilan fondamental |
| CP + PNC + PC = Total Passif | ±2% | SYSCOHADA, découverts |
| REX + D&A = EBE | ±2% | Reconstitution EBITDA |
| RN = (RAI − Impôts) OU (RAI + Impôts) | ±10% | Flex sur impôts negatifs |
| BPA ≈ RN / actions | ±5% | Si actions_en_circulation |

---

**Prochaine : Task 14 (finalisation, audit réconciliation, 0 écarts > 2%)**
