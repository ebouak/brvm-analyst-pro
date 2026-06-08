# États financiers par famille comptable — Design

**Date :** 2026-06-08
**Statut :** validé en brainstorming, en attente de revue utilisateur avant plan d'implémentation.

## Problème

Les tables `income_statements` / `balance_sheets` ont un schéma unique de type **SYSCOHADA industriel/commercial**. Pour les banques (et a fortiori les assurances), de nombreuses colonnes (`stocks`, `fournisseurs`, `marge_brute`, `cout_ventes`, `creances_clients`) restent **NULL non pas parce que la donnée manque, mais parce que le concept n'existe pas** pour ces secteurs. À l'inverse, leurs lignes propres (PNB, dépôts, crédits, provisions techniques) n'ont aucune colonne où aller. De plus, le champ `secteur` de `brvm_instruments` est **vide pour les 48 actions**.

## Décisions (validées)

| Axe | Décision |
|---|---|
| Périmètre | Classifier + capturer par secteur + adapter l'affichage |
| Familles | **3** : `banque` (réf. BCEAO), `assurance` (réf. CIMA), `general` (SYSCOHADA) |
| Stockage | **Hybride** : socle commun en colonnes typées + `lignes_specifiques jsonb` |
| Classification | **Mapping manuel** des 48 tickers, figé en migration |
| Ré-extraction | **Ciblée** : seulement banque + assurance |
| Affichage | **Dictionnaire de libellés** par famille |

## Architecture

Le **socle commun reste canonique** : `revenu_total` (= CA industrie / **PNB** banque / primes acquises assurance), `resultat_net`, `total_actifs`, `total_passif`, `total_capitaux_propres`, `tresorerie_equivalents`. Conséquence clé : **le Diagnostic IA et les exports XLS/PDF ne changent pas** — ils continuent de lire ces colonnes. Les `lignes_specifiques` sont du **détail additif** propre à chaque famille.

## Modèle de données — migration `0025`

1. `brvm_instruments` :
   - `famille_comptable text` avec `check (famille_comptable in ('banque','assurance','general'))`, défaut `'general'`.
   - Remplissage de `secteur` (BRVM fin) au passage.
2. `income_statements` et `balance_sheets` : `lignes_specifiques jsonb` (nullable).
   - (Les flux de trésorerie restent communs ; pas de `lignes_specifiques` sur `cash_flow_statements` dans cette version — YAGNI.)

### Contenu de `lignes_specifiques` par famille

- **Banque** : `pnb`, `produit_interets`, `marge_interets`, `depots_clientele`, `credits_clientele`, `coefficient_exploitation`, `ratio_solvabilite`, `creances_douteuses`.
- **Assurance** : `primes_emises`, `primes_acquises`, `charges_sinistres`, `provisions_techniques`, `placements`, `ratio_combine`.
- **Général** : `lignes_specifiques` reste `null` (le schéma de colonnes le couvre déjà).

Les montants agrégés sont en **FCFA bruts** (mêmes règles d'unité que l'existant). Les ratios (`coefficient_exploitation`, `ratio_solvabilite`, `ratio_combine`) sont en **pourcentage** (nombre, ex. `58.3`).

## Classification des 48 sociétés (proposée — à valider)

**Banque (15)** : BICB, BICC, BOAB, BOABF, BOAC, BOAM, BOAN, BOAS, CBIBF, ECOC, ETIT, NSBC, ORGT, SGBC, SIBC.

**Assurance (0)** : aucune assurance pure cotée dans la liste actuelle. La famille est **définie pour l'avenir** (template prêt) mais sans société affectée au lancement.

**Général (33)** : ABJC, BNBC, CABC, CFAC, CIEC, FTSC, LNBB, NEIC, NTLC, ONTBF, ORAC, PALC, PRSC, SAFC, SCRC, SDCC, SDSC, SEMC, SHEC, SICC, SIVC, SLBC, SMBC, SNTS, SOGC, SPHC, STAC, STBC, SVOC, TTLC, TTLS, UNLC, UNXC.

**Notes de classification (confirmées par l'utilisateur le 2026-06-08)** :
- **SMBC** = Société Multinationale de Bitumes → `general` (Industrie), PAS une banque.
- **SAFC** (SAFCA, crédit-bail) → `general` (Finance).

Le `secteur` BRVM fin (Télécom, Agro-industrie, Distribution, Énergie, BTP, Finance…) sera renseigné dans le même mapping (table de correspondance code → `{famille_comptable, secteur}`).

## Extraction par famille

- `frontend/lib/import/fullPrompt.ts` → fonction `buildPrompt(famille)` qui ajoute, après les champs communs, la liste des lignes spécifiques attendues pour la famille (vers un objet `lignes_specifiques` dans le JSON renvoyé).
- `frontend/lib/import/fullStatement.ts` → le schéma zod par exercice gagne `lignes_specifiques: z.record(z.number().nullable()).nullable()`.
- `frontend/lib/import/fullGuardrails.ts` → inchangé sur le socle (bilan équilibré, magnitude). Pour `banque`, un contrôle léger optionnel : `credits_clientele + tresorerie ≤ total_actifs * 1.05` (si les deux présents).
- `frontend/lib/import/fullPersist.ts` → `toRows` écrit `lignes_specifiques` dans `income_statements` et `balance_sheets` (réparti : PNB/produits → income ; dépôts/crédits/ratios → balance).
- **Ré-extraction ciblée** : script de backfill (même patron que l'OCR) limité aux 16 banques, avec le prompt `banque`. Les sociétés `general` ne sont pas retouchées.

## Affichage

- `frontend/lib/financials/sectorLabels.ts` (nouveau) : `Record<Famille, Record<string,string>>` — clé JSON → libellé FR (ex. `banque.pnb = "Produit Net Bancaire"`).
- `frontend/components/financials/FinancialTabs.tsx` (ou un sous-composant) : bloc commun inchangé + **bloc « Spécificités <famille> »** qui itère sur `lignes_specifiques` en n'affichant que les clés présentes, libellées via le dictionnaire. Lignes absentes = non rendues (plus de « N/D »).
- Fiche société : badge `famille` + `secteur`.

## Impact sur l'existant (non régressif)

- **Diagnostic IA** (`lib/diagnostic/*`) : lit le socle commun → inchangé. Optionnel (hors périmètre v1) : enrichir le prompt de diagnostic des banques avec les ratios prudentiels.
- **Export XLS/PDF** : lit le socle commun → inchangé. Optionnel : une feuille/section « spécificités » si `lignes_specifiques` présent.
- **Migrations** : `0025` additive (colonnes nullable) → aucune rupture.

## Tests

- **Pur (vitest)** :
  - `sectorLabels` : chaque clé attendue par famille a un libellé.
  - mapping de classification : les 48 codes ont une `famille_comptable` valide ; pas de doublon ; couverture = 48.
  - `fullGuardrails` banque : le contrôle crédits/trésorerie rejette une incohérence grossière, accepte un cas réel.
  - `fullPersist` : `toRows` place bien `lignes_specifiques` dans income vs balance selon la clé.
- **Vérif DB après ré-extraction** : banques ont `balance_sheets.lignes_specifiques->>'depots_clientele'` rempli ; bilans toujours équilibrés ; sociétés `general` inchangées.

## Hors périmètre (YAGNI)

- `lignes_specifiques` sur les flux de trésorerie.
- Ratios prudentiels dans le diagnostic des banques.
- Récupération automatique du secteur BRVM depuis brvm.org (le mapping manuel suffit).
- Famille assurance peuplée (aucune société cotée actuellement).
