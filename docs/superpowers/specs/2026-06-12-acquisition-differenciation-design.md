# Cahier des charges — Pack Acquisition & Différenciation

**Date :** 2026-06-12
**Statut :** À valider
**Objectif business :** acquisition rapide de clients + positionnement différenciant face à Sika Finance (info) et Rich Bourse (formation).

---

## 1. Contexte et positionnement

### 1.1 Constat concurrentiel

| Acteur | Proposition | Faiblesse exploitable |
|---|---|---|
| Sika Finance | Actualités + cours | Pas d'outils de décision, pas de personnalisation |
| Rich Bourse | Formation payante + simulation | Pas d'analytique temps réel, pas de données structurées |
| **BRVM Analyst Pro** | **Décision** : signaux, scores, IA, fondamentaux structurés | Notoriété faible, trafic faible |

### 1.2 Positionnement retenu

> **« Sika informe. Rich Bourse forme. BRVM Analyst Pro décide. »**

La plateforme est l'outil d'**aide à la décision** du marché UEMOA. Tout ce qui est construit dans ce pack sert ce positionnement : exposer publiquement l'intelligence déjà construite (scoring, fondamentaux 44/48 sociétés, diagnostic IA) pour générer du trafic, puis convertir vers premium.

### 1.3 Actifs existants réutilisés (aucune nouvelle collecte de données)

- `signals_daily` : scoring explicable 0–100 avec sous-scores et confiance
- `income_statements` / `balance_sheets` / `cash_flow_statements` : fondamentaux 44/48 sociétés
- `brvm_actions_daily` : historique de cours + intraday 15 min
- `dividends` : historique des dividendes
- `diagnostic_reports` : diagnostic IA sell-side (TTL 7 j)
- `brvm_news` : actualités scrapées (brvm.org, Sika, cosumaf)
- Canal Telegram déjà câblé (`alerts/channels`)

---

## 2. Périmètre

Quatre fonctionnalités, ordonnées par impact acquisition :

| # | Fonctionnalité | Type | Effort estimé |
|---|---|---|---|
| F1 | Pages sociétés publiques SEO (48 pages) | Acquisition organique | M |
| F2 | Note BRVM A–F par action | Différenciation produit | S |
| F3 | Simulateur viral « Et si vous aviez investi… » | Acquisition virale | S |
| F4 | Brief quotidien Telegram (puis WhatsApp) | Rétention + liste prospects | M |

Hors périmètre (phases ultérieures) : paiement mobile money, API B2B, backtesting, brief audio.

---

## 3. F1 — Pages sociétés publiques SEO

### 3.1 Objectif
48 pages riches, **accessibles sans compte**, indexables par Google, qui rankent sur les requêtes « action SONATEL », « dividende SGBCI », « cours BICICI », etc. C'est le moteur d'acquisition : coût marginal nul, trafic organique durable.

### 3.2 Spécifications fonctionnelles

**Route :** `/societes/[code]` (publique, hors middleware d'auth).
**Index :** `/societes` — annuaire des 48 sociétés filtrable par secteur/pays.

Contenu de chaque page (toutes les sections alimentées par les données existantes) :

1. **En-tête** : logo/nom, code, secteur, pays, cours actuel, variation jour, badge **Note BRVM** (cf. F2).
2. **Graphique de cours** : 1 an de clôtures (Recharts, déjà disponible).
3. **Chiffres clés** : capitalisation, volume moyen, dividende/rendement, plus haut/bas 52 s.
4. **Fondamentaux** (si disponibles — 44/48) : CA, résultat net, capitaux propres, BPA sur 3 exercices + 4 ratios (PER, ROE, marge nette, rendement dividende). Tableau simple, prose dérivée des métriques (`lib/narrative.ts`, jamais de texte inventé).
5. **Historique des dividendes** : tableau exercice/montant/date.
6. **Actualités liées** : 5 dernières news de `brvm_news` filtrées par `instrument_code`.
7. **Teaser diagnostic IA** : les 3 premières lignes du diagnostic, le reste flouté avec CTA « Créer un compte gratuit pour lire l'analyse complète ». **C'est le convertisseur principal.**
8. **CTA secondaires** : « Ajouter à ma watchlist », « Simuler un investissement » (→ F3).

### 3.3 Spécifications SEO (critiques)

- `generateMetadata` dynamique : title `« Action {NOM} ({CODE}) — Cours, dividendes, analyse | BRVM Analyst Pro »`, description dérivée des métriques du jour.
- **ISR** : `revalidate = 900` (15 min, aligné sur l'intraday) — pages statiques rapides, données fraîches.
- **JSON-LD** schema.org (`Corporation` + `FinancialProduct`).
- `app/sitemap.ts` : génération automatique des 48 URL + pages index.
- `app/robots.ts` : autoriser `/societes/*`, interdire `/dashboard`, `/api`.
- Open Graph image par société (route `opengraph-image` avec next/og : nom + cours + note + variation) → partages WhatsApp/X propres.
- Maillage interne : chaque page lie 4 sociétés du même secteur.

### 3.4 Contraintes
- Le middleware Supabase actuel doit exclure `/societes` de la redirection login (modifier le matcher).
- État vide géré : société sans fondamentaux (4 cas) → section masquée proprement, pas de « N/A » bruts.
- Aucune clé service_role côté frontend : lecture via clé anon + RLS (les tables concernées sont déjà en lecture publique).

### 3.5 Critères d'acceptation
- [ ] Les 48 pages se chargent sans authentification, < 1,5 s (ISR).
- [ ] `curl` sans cookie retourne le HTML complet (pas de redirect login).
- [ ] Sitemap accessible et valide ; pages soumises à Google Search Console.
- [ ] Teaser diagnostic flouté + CTA inscription fonctionnel.
- [ ] Lighthouse SEO ≥ 95 sur 3 pages échantillon.

---

## 4. F2 — Note BRVM A–F par action

### 4.1 Objectif
Traduire le scoring existant (0–100, explicable) en une **note lettre mémorisable et citable** : « BRVM Analyst note SONATEL A− ». La note devient la signature de la marque (équivalent local de la note Morningstar).

### 4.2 Spécifications fonctionnelles

**Barème** (dérivé de `signals_daily.score`) :

| Score | Note |
|---|---|
| ≥ 85 | A+ |
| 75–84 | A |
| 65–74 | B+ |
| 55–64 | B |
| 45–54 | C |
| 35–44 | D |
| < 35 | E |
| Données insuffisantes / confiance < seuil | NR (non noté) |

- **Fonction pure** `lib/rating.ts` : `scoreToRating(score, confidence) → { note, couleur }` + tests.
- **Composant** `<RatingBadge>` (kit premium existant) : badge coloré (vert→rouge), tooltip « Pourquoi cette note ? » listant les sous-scores (explicabilité déjà en base).
- **Affichage** : pages sociétés (F1), tableau marché, screener, fiches instrument, OG images.
- La note **gratuite** est visible partout ; le **détail complet** des sous-scores reste premium.

### 4.3 Règles d'honnêteté (non négociables)
- Si la confiance du signal est sous le seuil existant de neutralisation → NR, jamais une note inventée.
- Mention visible : « Note indicative fondée sur l'analyse technique et les signaux quantitatifs — pas un conseil en investissement. »

### 4.4 Critères d'acceptation
- [ ] `scoreToRating` testée (vitest) sur les bornes du barème + cas NR.
- [ ] Badge visible sur les 48 pages publiques et le tableau marché.
- [ ] Tooltip d'explicabilité fonctionnel.

---

## 5. F3 — Simulateur viral « Et si vous aviez investi… »

### 5.1 Objectif
Outil public et ludique : « Si vous aviez investi 1 000 000 FCFA dans SONATEL en 2020, vous auriez aujourd'hui X FCFA. » Résultat **partageable en un clic** (image OG dédiée) → boucle virale WhatsApp/Facebook/X, où se trouve l'audience UEMOA.

### 5.2 Spécifications fonctionnelles

**Route :** `/simulateur` (publique) + `/simulateur/[code]` (pré-rempli, lié depuis F1).

Entrées : société (sélecteur 48 valeurs), montant FCFA (défaut 1 000 000), date de départ (présets : 1 an, 3 ans, 5 ans, ou année précise selon historique disponible).

Calcul (fonction pure `lib/simulate.ts` + tests) :
- Valeur finale = montant × (cours_final / cours_initial)
- **Dividendes cumulés** ajoutés (table `dividends`) — affichés séparément : « dont X FCFA de dividendes »
- Rendement total %, rendement annualisé %
- Comparaison : « vs 3 % sur un compte épargne » (paramètre constant documenté)

Sorties UI : montant final en gros (`.tabular`), graphique de l'évolution, détail dividendes, **bouton « Partager »** → URL avec OG image générée (next/og : « 1 M FCFA → 2,4 M FCFA en 5 ans avec SONATEL 📈 »).

### 5.3 Règles d'honnêteté
- Si l'historique en base ne couvre pas la date demandée → proposer la plus ancienne date disponible, jamais d'extrapolation.
- Mention : « Performances passées ne préjugent pas des performances futures. »

### 5.4 Critères d'acceptation
- [ ] `lib/simulate.ts` testée (rendement simple, avec dividendes, périodes partielles).
- [ ] Lien de partage produit une OG image correcte (testé WhatsApp).
- [ ] Page fonctionnelle sans compte.

---

## 6. F4 — Brief quotidien Telegram (puis WhatsApp)

### 6.1 Objectif
Un résumé de séance automatique envoyé chaque jour de bourse : crée l'habitude, construit une liste d'abonnés (prospects premium), démontre la qualité des données.

### 6.2 Phasage canal (réaliste)
- **Phase 1 — Telegram** : canal public `@brvmanalyst` ; le scraper poste déjà via bot (`alerts/channels`) → réutilisation directe.
- **Phase 2 — WhatsApp** : WhatsApp Cloud API (Meta) exige validation business + coûts par message → reporté ; en attendant, bouton « Partager le brief sur WhatsApp » (lien `wa.me`) dans la version web du brief.

### 6.3 Spécifications fonctionnelles

**Génération** (scraper, étape ajoutée au workflow post-clôture 16h00 UTC) :
- Composition à partir des données du jour (fonction pure `scraper/src/brief/compose.ts` + tests) :
  1. BRVM-C et BRVM-30 : valeur + variation
  2. Top 3 hausses / top 3 baisses (code + %)
  3. Volume total échangé
  4. 1–2 actualités du jour (titres `brvm_news`)
  5. « Note du jour » : la société dont la note (F2) a changé, s'il y en a une
  6. Lien vers le site (UTM `?utm_source=telegram&utm_medium=brief`)
- Format : message texte ≤ 12 lignes, chiffres formatés FR.
- Envoi : canal Telegram via bot existant. Idempotent (un seul brief par séance, journalisé dans `scraper_logs`).
- **Version web** : `/brief` (publique, SEO) — archive des briefs, chaque brief = une page datée indexable.

### 6.4 Critères d'acceptation
- [ ] `compose.ts` testée sur fixture de séance (y compris séance sans actualités).
- [ ] Brief publié automatiquement après le run post-clôture ; pas de doublon si relance.
- [ ] Page `/brief` publique avec l'historique.

---

## 7. Architecture technique transverse

- **Aucune nouvelle table** sauf : `brief_daily` (date_marche PK, contenu text, sent_at) — migration 0035.
- **Aucun nouveau scraping** : tout dérive des tables existantes.
- **Découplage préservé** : le frontend lit Supabase uniquement ; la génération/envoi du brief reste côté scraper (GitHub Actions).
- **Design system** : kit `@/components/ui/premium` existant (DeFi cyan), classe `.tabular` pour tous les chiffres, prose française.
- **Pages publiques** : modifier `middleware.ts` (matcher) pour exclure `/societes`, `/simulateur`, `/brief` ; vérifier que la RLS couvre la lecture anonyme (déjà le cas pour les tables concernées).

## 8. KPIs de succès (90 jours)

| Indicateur | Cible |
|---|---|
| Pages sociétés indexées Google | 48/48 |
| Trafic organique mensuel | > 5 000 sessions |
| Abonnés Telegram | > 1 000 |
| Taux inscription depuis teaser IA | > 4 % des visiteurs pages sociétés |
| Partages simulateur (clics bouton) | > 500/mois |

## 9. Ordre d'implémentation recommandé

1. **F2** (note A–F) — petite, requise par F1 et F4
2. **F1** (pages SEO) — le moteur d'acquisition
3. **F3** (simulateur) — vite fait, lié depuis F1
4. **F4** (brief Telegram) — boucle de rétention

Chaque fonctionnalité = livrable autonome, testable, déployable séparément.
