# Inventaire des sources prudentielles bancaires — 2026-10-07

Objectif : trouver, pour les 15 banques cotées, le ratio de solvabilité (total, CET1, Tier 1) et les créances en souffrance (montant brut, taux, couverture), avant d'envisager une source payante.

Statut de chaque ligne : **lu** = extrait par Gemini avec page et libellé ; **repéré** = vu dans un résultat de recherche, document à lire ; **absent** = cherché, non trouvé dans les documents consultés.

## Sources communes

| Source | Contenu utile | Limite |
|---|---|---|
| BDFIN / brvm.org — états financiers annuels | PNB, résultat, bilan, coût du risque, intérêts | Aucune solvabilité, aucune créance en souffrance brute, aucun flux (vérifié page par page sur SGBC 2025) |
| BDFIN — « Notation financière » | Note Bloomfield | Communiqué d'une page, sans ratio prudentiel |
| Commission bancaire UMOA, rapport annuel 2025 (bceao.int, 6,1 Mo) | Par banque : total bilan, dépôts, crédits (annexe II.1.1.a, p. 159-161) | Solvabilité jamais publiée par banque (moyennes pays / Union) ; utile en **recoupement** du bilan (SGBC : 3 783 420 M contre 3 769 174 M publiés) |

## Par banque

| Code | Source trouvée | Indicateurs | Statut |
|---|---|---|---|
| SGBC | institutionnel.societegenerale.ci — rapport d'activité 2025 | taux de créances en souffrance 8 % ; couverture 82 % (p. 1, périmètre non précisé) | **lu** |
| SGBC | même site — document de référence 2024 | solvabilité 15,8 % / 16,3 % | repéré (2025 à chercher) |
| ORGT | orabank.net — rapport CAC, comptes consolidés IFRS 2025 | solvabilité globale 2,20 % ; CET1 0,78 % ; Tier 1 0,93 % ; « créances douteuses » 494 961 M (IFRS, consolidé, p. 49 et 87) | **lu** |
| SIBC | sib.ci — document de référence 2025 (exercice **2024**) | solvabilité 14,39 % (p. 5) ; créances en souffrance 72 874 M (p. 64, individuel) ; dépréciation 81 % | **lu** — période 2024 ≠ base 2025 |
| BICB | rapport IFRS 2025 (BRVM) | solvabilité totale 19,64 % (CET1 = T1 = total) | repéré |
| NSBC | nsiabanque.ci — rapports annuels | « ratio de solvabilité total » (13,36 % en 2024 selon une note de recherche) | repéré |
| ETIT | Ecobank Group annual report 2025 (anglais, USD, consolidé) | Total CAR 16,7 % (estimation) ; CET1 13,2 % ; NPL ratio 9,4 % | repéré |
| ECOC | rapport d'activités 2025 (BRVM) | coût du risque, ROE ; ratios prudentiels « au-dessus des exigences » sans chiffre | repéré, chiffre absent |
| BOAS, BOAC | présentation des résultats (3 mars 2025, p. 52 et 62) + rapports annuels 2024 (49 Mo, p. 52, lus par l'API de fichiers) | solvabilité 2023 concordante (13,9 % ; 13,6 %) ; **2024 en conflit** : 14,9 % contre 14,4 % (BOAS), 16,9 % contre 14,2 % (BOAC) | **lu** — `source_conflict` |
| BOAM, BOAN, BOAB, BOABF | présentation des résultats (mars 2025) ; BOA Niger : rapport du CA 2025 « annule et remplace » | solvabilité 2023-2024 de la présentation ; rapports annuels non lus | lu (présentation seule) |
| CBIBF | burkina.coris.bank — rapports d'activités 2025 | à lire | repéré |
| BICC | rapport d'activités annuel 2025 (BRVM) | à lire | repéré |

## Constats pour la collecte

1. Le périmètre est souvent **non écrit** : il doit rester « non précisé ».
2. Les définitions diffèrent (PCB « créances en souffrance » individuel, IFRS « créances douteuses » consolidé) : pas de fusion.
3. Les documents de référence portent souvent sur l'exercice **précédent** : la période doit être signalée.
4. Aucune publication intitulée « Pilier 3 » n'a été trouvée pour une banque cotée de l'UMOA ; les ratios figurent dans les rapports annuels, documents de référence et comptes IFRS.

## Décisions

**2026-10-07 — conflit entre deux documents de l'émetteur : pas d'arbitrage par la date.**
BOAS et BOAC 2024 : la présentation des résultats (mars 2025) et le rapport annuel
(septembre 2025) donnent des ratios incompatibles à une décimale. Le rapport annuel
est plus récent et son ratio se recalcule depuis Tier 1, Tier 2 et RWA ; il n'en est
pas pour autant retenu. Une règle « le document définitif le plus récent l'emporte »
reviendrait à trancher à la place de l'émetteur, et ne s'appliquerait qu'aux banques
qui publient les composantes — deux régimes coexisteraient. Les deux observations
restent en `publie_non_exploitable` / `source_conflict`, le recalcul est consigné en
commentaire. À rouvrir si l'émetteur publie un erratum ou si un contrôle manuel tranche.

**Piège : les rapports annuels des filiales BOA reprennent, p. 23, les chiffres de
BOA Group consolidé** (« Ratio de solvabilité estimé 12,6 % / 14,5 % »). Ils sont
identiques d'un rapport de filiale à l'autre et ne concernent aucune filiale.
