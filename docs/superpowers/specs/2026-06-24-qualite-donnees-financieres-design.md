# Qualité des données financières — Design

**Date :** 2026-06-24 · **Statut :** Validé
**Objectif :** corriger et compléter les états financiers (income / balance / cash-flow)
de 13 sociétés BRVM en base, à partir des **états financiers audités** (source unique),
en réparant le défaut de réconciliation du bilan (découverts bancaires omis).

## Contexte

Un audit de réconciliation a révélé que **27 bilans / 13 sociétés** ne réconcilient pas
(`CP + passif_non_courant + passif_courant` ≠ `total_passif`, écart > 2 %), cause :
la « Trésorerie-Passif » SYSCOHADA (découverts) était omise de `passif_courant`.
Le pipeline d'import a été corrigé (garde-fou + prompt) ; il reste à **corriger les
données déjà stockées**. BNBC a déjà été traité manuellement (modèle de référence).

Sociétés : SPHC, SLBC, SCRC, NTLC, ONTBF, CFAC, SMBC, TTLC, PRSC, UNLC, UNXC, SHEC.

## Source de vérité

**États financiers audités** dans la table `publications`
(`type_publication = 'etats_financiers'`, `source_url` = PDF). Vérifié : chaque société
dispose de PDF audités 2020→2025 (chaque PDF contient N et N-1). **Exception : UNLC**
— dernier audité = exercice 2023 → 2024/2025 « non publié ».

Les **fiches MADIS Invest** (fournies par l'utilisateur) ne sont qu'un **contrôle croisé** :
elles contiennent des erreurs de transcription (ex. SMBC 2022 charges −3 377 ;
SCRC 2024 charges −1 492 ; UNXC 2024 bilan = 0). **Aucune valeur de fiche n'est écrite.**

## Flux par société (unité d'exécution = 1 sous-agent / société)

1. **Lister** les PDF audités de la société depuis `publications` (filtrer `etats_financiers`,
   exclure semestriels/trimestriels ; garder les exercices annuels les plus récents).
2. **Télécharger** chaque `source_url` dans le scratchpad (`curl`).
3. **Lire & extraire** le PDF (lecture directe par l'agent, comme BNBC) : pour chaque
   exercice présent (N et N-1) → income + bilan détaillé + cash-flow.
   - **Unités** : lire l'en-tête (« en milliers / millions / FCFA ») et convertir en FCFA bruts.
   - **Découverts** : la Trésorerie-Passif (banques, crédits de trésorerie) va dans
     `passif_courant` ET `dette_court_terme`.
4. **Garde-fous** (rejet + signalement si échec, jamais d'écriture douteuse) :
   - `|total_actifs − total_passif| / total_passif ≤ 1 %`
   - `|(CP + passif_non_courant + passif_courant) − total_passif| / total_passif ≤ 2 %`
   - `REX + depreciation_amortissement ≈ EBE publié` (tol. 2 %)
   - `benefice_par_action ≈ resultat_net / actions_en_circulation` (tol. 5 %)
   - `resultat_net ≈ resultat_avant_impots ± impots` (tol. 10 %)
5. **Écrire** via service_role (`scraper/.env.local`), upsert idempotent sur
   `(code, periode, type_periode='annuel')`, colonnes alignées sur les migrations.
6. **Contrôle croisé fiche MADIS** : comparer CA, REX, RN, total bilan, dettes financières ;
   consigner tout écart > 5 % dans le rapport (ne corrige pas la base).

## Tables & colonnes cibles

- `income_statements` : revenu_total, cout_ventes, resultat_exploitation,
  charges_financieres_nettes (valeur positive de la charge nette), resultat_avant_impots,
  impots, resultat_net, benefice_par_action, actions_en_circulation, dividende_par_action.
- `balance_sheets` : total_actifs, total_actif_non_courant, actifs_incorporels,
  immobilisations_nettes, investissements_long_terme, total_actif_circulant, stocks,
  creances_clients, tresorerie_equivalents, total_passif, total_capitaux_propres,
  capital_social, reserves_benefices_non_repartis, passif_non_courant, dette_long_terme,
  passif_courant (**découverts inclus**), dette_court_terme (**= découverts**), fournisseurs,
  autres_passifs_courants.
- `cash_flow_statements` : flux_exploitation, resultat_net, depreciation_amortissement (net),
  variation_bfr, flux_investissement, investissements_ppe, flux_financement,
  remboursement_dette, dividendes_verses, variation_tresorerie,
  tresorerie_debut_periode, tresorerie_fin_periode.

## Dépendances post-écriture

- Purger le cache `diagnostic_reports` des sociétés touchées (régénération propre).
- `/financials/[code]` et `/premium/diagnostic/[code]` refléteront les données corrigées.

## Livrables

1. Données corrigées en base (income/balance/cash 2020→2025 où audité disponible).
2. **Rapport qualité** `presentations/audit-financier/rapport-qualite.md` : par société/année,
   ce qui a été écrit, les garde-fous passés, les écarts fiche↔audité détectés, les années
   non disponibles.
3. Audit de réconciliation final : 0 bilan touché restant > 2 % (hors années non publiées).

## Hors périmètre (YAGNI)

- Sociétés hors des 13 (déjà conformes ou à traiter séparément).
- Refonte du pipeline d'extraction LLM (déjà corrigé).
- Données infra-annuelles (semestriels/trimestriels) — uniquement annuel.
- Extraction via clés LLM : on lit les PDF directement (fidélité + pas de coût/clé).

## Tests / vérification

Pas de code applicatif nouveau → vérification par requêtes : pour chaque société écrite,
relire et confirmer les 5 garde-fous + la reconstruction EBITDA par année (script Node
ad hoc, même mécanique que la vérification BNBC).
