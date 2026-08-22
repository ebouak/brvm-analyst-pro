# LANDING-V2-REPORT

**Branche** : `feature/landing-v2` (créée depuis `main`)
**Production** : `origin/main` = `595626b` — **intacte, non modifiée**
**Date** : 2026-08-22
**Statut** : audit et plan. **Aucune modification de production. Rien de déployé.**

---

## A. État actuel

### A.1 Fichiers responsables de la landing

| Fichier | Lignes | Rôle |
|---|---|---|
| `frontend/app/page.tsx` | 948 | Entrée, chargement des données, composition des sections |
| `components/landing/taste/TasteTopbar.tsx` | — | Header (logo, nav, CTA, bascule de thème) |
| `components/NewsTicker.tsx` | — | Bandeau défilant des cours |
| `components/landing/HeroDeviceMockup.tsx` | 122 | Hero sombre + aperçu produit |
| `components/landing/ProofBand.tsx` | 106 | Bandeau de preuve + logos de sources |
| `components/landing/MoverSparkline.tsx` | 30 | Mini-courbe SVG des movers |
| `components/landing/IndicesCompactCard.tsx` | 68 | Indices, format compact |
| `components/landing/LandingHeatmap.tsx` | — | Cartographie du marché |
| `components/landing/ToolsGrid.tsx` | 159 | Grille des 12 outils |
| `components/landing/RatingSpotlight.tsx` | — | Mise en avant note A–F |
| `components/landing/AppPreview.tsx` | — | Aperçu de l'application |
| `components/landing/PremiumCompare.tsx` | 56 | Comparatif des formules |
| `components/landing/LandingFaq.tsx` | — | FAQ |
| `components/NewsletterForm.tsx` | 187 | Formulaire newsletter (variante `banner`) |
| `components/Footer.tsx` | 126 | Footer + disclaimer financier |
| `lib/landing/sparkline.ts` | 38 | Géométrie SVG pure (6 tests) |
| `lib/landing/excerpt.ts` | — | Extrait de texte (7 tests) |
| `lib/landing/memberCount.ts` | 24 | Comptage réel des comptes (service-role) |
| `lib/marketDate.ts` | — | Dernière séance, partagée |
| `lib/heatmapData.ts` | — | Chargement de la cartographie |
| `lib/brvmSectors.json` | — | Classification GICS de 47 tickers en 7 secteurs |

### A.2 Stack

Next.js 14 App Router · React 18 · TypeScript strict · TailwindCSS (`darkMode: 'class'`, tokens DeFi cyan) · Supabase (client public anon, RLS) · Recharts · Sentry.
Rendu : Server Component, `unstable_cache` 300 s sur `getData()`, `revalidate = 300`.

### A.3 Ordre des sections aujourd'hui

1. Header · 2. Ticker · 3. Hero · 4. Bandeau de preuve · 5. **Marché en direct — 4 colonnes** (Top 5 hausses | BRVM-C | Top 5 baisses | **Indices**) · 6. **Cartographie (1/3) + Outils (2/3) côte à côte** · 7. Diagnostic IA \| Simulateur \| SGI · 8. **3 étapes** · 9. Communauté \| Premium \| Brief · 10. **Analyse \| Actualités** · 11. **PremiumCompare pleine largeur** · 12. **FAQ** · 13. Newsletter · 14. CTA final · 15. Footer

### A.4 Modèle d'accès (vérifié empiriquement, pas supposé)

| Route | Sans session |
|---|---|
| `/`, `/societes` | **200** — public |
| `/screener`, `/signaux`, `/obligations`, `/dashboard` | **307** → connexion |

La vitrine est publique, les outils sont derrière le mur d'authentification (`lib/supabase/middleware.ts`).
**Conséquence rédactionnelle** : on ne peut pas écrire « le site est consultable sans inscription ».

---

## B. Architecture cible (écart avec la créa de référence)

La créa fournie diffère de celle qui a servi à l'implémentation actuelle. Écarts structurels :

| # | Créa de référence | Implémentation actuelle | Action |
|---|---|---|---|
| B1 | Marché en direct sur **3 colonnes** | 4 colonnes (Indices en 4ᵉ) | Sortir les indices de la grille |
| B2 | **Indices (≈45 %) + Cartographie (≈55 %)** sur une même ligne | Cartographie collée aux Outils | Nouvelle ligne dédiée |
| B3 | Rangée **SECTEURS** (6–7 pastilles, variation du jour) | **inexistante** | Section à créer |
| B4 | Outils **pleine largeur**, 4 × 3 | 2/3 de largeur, 4 colonnes serrées | Passer en pleine largeur |
| B5 | Indices en **4 cartes** avec valeur + variation | Liste compacte | Reformater |
| B6 | Footer à **5 colonnes** + logos de sources | 3 colonnes, 6 liens | Étendre |
| B7 | Hero : biseau d'ordinateur portable + rail d'icônes app | Panneau plat | Habillage |
| B8 | Diagnostic : barres de sous-scores (Fondamentaux, Momentum, Dividende, Valorisation, Risque) | absentes du hero | À ajouter |
| B9 | Pas de « 3 étapes », ni « Analyse/Actualités », ni FAQ, ni PremiumCompare pleine largeur | présents | **Déplacer, pas supprimer** (§20) |

### B.2 Source de données de la rangée SECTEURS (B3)

`brvm_instruments.secteur` est **vide** : 330 lignes nulles sur 331 actives. La classification fiable vit dans `lib/brvmSectors.json` (47 tickers → 7 secteurs), déjà utilisée par la cartographie.

La variation sectorielle du jour se calcule donc : jointure `brvmSectors.json` × `brvm_actions_daily.variation_pct` de la dernière séance, moyenne pondérée par la capitalisation (`shares` × `cours_jour`). Aucun chiffre à saisir.

Les 7 secteurs réels : Services financiers (16), Consommation de base (9), Consommation discrétionnaire (7), Industriels (6), Énergie (4), Télécommunications (3), Services publics (2).

---

## C. Fonctionnalités conservées

Inventaire complet, toutes présentes dans le code et à conserver (§20) :

**Marché** — ticker temps réel · Top 5 hausses · Top 5 baisses · BRVM-C (valeur, variation, volume, transactions) · 11 indices · cartographie/heatmap · 48 sociétés · mini-courbes réelles
**Analyse** — notes A–F · fondamentaux · signaux BUY/HOLD/SELL · screener (RSI, MACD, dividendes) · conseiller unifié · Diagnostic IA · méthodologie
**Outils** — simulateur · simulateur budget · paper trading · watchlist · alertes · obligations · matières premières · comparateur SGI · API/developers
**Contenu** — brief quotidien · actualités · analyses hebdo · academy
**Produit** — Premium/pricing · communauté · newsletter · FAQ · CTA · footer · disclaimer

**26 routes liées, toutes vérifiées existantes. Aucun lien mort.**

---

## D. Fonctionnalités déplacées (jamais supprimées)

La créa ne montre pas ces quatre blocs. §20 interdit de les retirer — ils sont donc **relogés** :

| Bloc | Destination proposée |
|---|---|
| **3 étapes** (Consultez la note / …) | Fusionné dans la grille Outils comme parcours d'entrée, ou déplacé sous le CTA final |
| **Analyse \| Actualités** (2 cartes) | Actualités rejoint la rangée Brief ; la carte Analyse fusionne avec la section Note A–F |
| **PremiumCompare** pleine largeur | Reste, placé après la rangée Premium (le comparatif à 3 colonnes est illisible en tiers de largeur) |
| **FAQ** | Conservée avant la newsletter — elle lève les objections et porte le `structured data` SEO |

---

## E. Composants à créer

| Composant | Rôle | Données |
|---|---|---|
| `SectorsRow.tsx` | Rangée des variations sectorielles (B3) | `brvmSectors.json` × `brvm_actions_daily` |
| `lib/landing/sectors.ts` | Calcul pur de la variation pondérée + tests | — |
| `IndicesRow.tsx` | 4 cartes d'indices (B5) | `brvm_indices_daily` |
| `LaptopFrame.tsx` | Biseau d'écran + rail d'icônes (B7) | présentation seule |
| `ScoreBars.tsx` | Barres de sous-scores du diagnostic (B8) | `signals_daily` |

---

## F. Composants à modifier

| Composant | Modification |
|---|---|
| `app/page.tsx` | Réordonnancement des sections B1, B2, B4, D |
| `IndicesCompactCard.tsx` | Reformatage en 4 cartes, ou remplacé par `IndicesRow` |
| `ToolsGrid.tsx` | Pleine largeur ; « 260+ obligations » → **269**, chiffre réel, à rendre dynamique |
| `HeroDeviceMockup.tsx` | Habillage biseau + barres de sous-scores |
| `Footer.tsx` | 3 → 5 colonnes, ajout du bloc sources |

---

## G. APIs impactées

**Aucune API modifiée. Aucune route modifiée. Aucune règle Premium touchée.**

Tables lues par la landing (inchangées) : `brvm_actions_daily`, `brvm_indices_daily`, `brvm_instruments`, `brvm_news`, `brief_daily`, `signals_daily`, `dividends`, `diagnostic_reports`, `subscription_plans`, `plan_features`, `sgi_directory`, `sgi_frais`, `profiles`.

**Une requête à ajouter** : les variations sectorielles réutilisent les lignes `brvm_actions_daily` **déjà chargées** pour les movers — aucun aller-retour supplémentaire.

---

## H. Risques

| # | Risque | Gravité | Mitigation |
|---|---|---|---|
| H1 | **§15 demande d'afficher « 2 000+ membres »** | **Élevée** | Voir encadré ci-dessous |
| H2 | `plan_features` est **vide** (0 ligne) → la carte Premium rend une liste vide | Moyenne | Antérieur à ce chantier. Seeder la table ou masquer le bloc quand vide |
| H3 | Aucun indice pour la date du jour (`brvm_indices_daily` = 0 aujourd'hui) | Faible | Repli sur la dernière date d'indices, déjà en place |
| H4 | Les logos BCEAO/Bloomfield sont des marques déposées | Faible | Attribution factuelle de source ; retirables en une ligne |
| H5 | Le hero et le footer ont des couleurs **fixes** (hors tokens) | Faible | Volontaire et documenté ; ne pas « corriger » |
| H6 | Le build local échoue par intermittence (OneDrive verrouille `.next`) | Faible | Purger `.next` avant build ; Vercel construit sur Linux |

> ### ⚠️ H1 — Conflit à trancher : le compteur de membres
>
> **§15 dit** : « Si le projet contient actuellement *2 000+ membres* alors l'afficher » et, deux lignes plus bas, « Ne jamais créer de faux utilisateurs ».
>
> **Les deux règles s'opposent ici**, parce que la prémisse de la première est fausse. Le `2 000+` était une **chaîne codée en dur** dans `app/page.tsx` ; il ne provenait d'aucune table et ne mesurait rien.
>
> Chiffres réels, vérifiés :
> - **71 comptes** créés (`select count(*) from profiles`, service-role — la clé anon voit 0 sous RLS).
> - **5 000+ abonnés TikTok**, chiffre que tu m'as donné, distinct et non mesurable par l'application.
>
> La branche affiche donc les deux, séparément et étiquetés. **Restaurer « 2 000+ » recréerait un faux compteur en production** ; je ne le ferai pas sans que tu me le demandes explicitement en connaissance de ces chiffres.
>
> Il manque `TIKTOK_URL` : sans elle, l'affirmation des 5 000 n'est pas vérifiable d'un clic.

---

## I. Tests

### Déjà exécutés sur cette branche

| Test | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ vert |
| `lib/landing/sparkline.test.mjs` | ✅ 6/6 |
| `lib/whatsappAgent/*.test.mjs` | ✅ 3/3 |
| `npm run build` (avant les 3 derniers commits) | ✅ 157/157 pages |
| Existence des 26 routes liées | ✅ aucune manquante |
| Modèle d'accès (200 vs 307) | ✅ vérifié route par route |
| Rendu HTML sur `localhost:3000` | ✅ 200, sections vérifiées |

### À exécuter après implémentation

Fonctionnel (ticker, CTA, auth, simulateur, SGI, IA, heatmap, newsletter) · responsive (desktop / laptop / tablette / mobile) · intégrité des données · liens du footer · Lighthouse.

---

## J. Captures avant/après

**Non produites.** Cette session n'a pas d'outil de capture d'écran vérifié. Je ne vais pas prétendre le contraire.

Deux façons de combler : tu captures toi-même depuis la preview, ou tu m'autorises à installer Playwright (déjà présent dans le dépôt via `e2e.yml`) pour scripter les captures desktop et mobile.

## K. Résultats Lighthouse

**Non exécuté.** Même raison : je ne rapporterai pas un score que je n'ai pas mesuré. `npx lighthouse http://localhost:3000` est lançable sur demande, mais un score mesuré en dev n'est pas représentatif — il faut le mesurer sur un build de production.

---

## L. Plan de rollback

1. **La production n'a pas bougé.** `origin/main` = `595626b`. Aucun push, aucun déploiement.
2. Tout le travail vit sur `feature/landing-v2`. `git checkout main` restaure l'état actuel instantanément.
3. Abandon total : `git branch -D feature/landing-v2`.
4. Si la branche est un jour fusionnée puis regrettée : `git revert` du commit de merge, redéploiement automatique par Vercel.
5. Vercel conserve les déploiements précédents : un rollback d'un clic reste disponible même après un push.

---

## M. Ce que j'attends de toi avant de coder

1. **Trancher H1** (compteur de membres).
2. **L'URL TikTok**, pour rendre les 5 000 vérifiables.
3. **Confirmer les déplacements de la section D** — c'est là que le risque de perdre une fonctionnalité est le plus réel.
4. **Valider l'ordre des étapes A→M** du §16, ou m'indiquer par laquelle commencer.

Aucune ligne de la landing ne sera modifiée avant ton accord explicite.
