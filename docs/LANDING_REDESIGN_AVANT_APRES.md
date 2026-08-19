# Comparaison avant / après — refonte de la landing page

Phase 11 du mandat de refonte. Compare l'état actuel de `/` (production,
inchangée) à l'aperçu `/landing-preview` (isolé, non publié, non indexé).
Source de vérité pour l'inventaire fonctionnel : `docs/LANDING_REDESIGN_AUDIT.md`
§2 et §12. Chaque ligne ci-dessous a été vérifiée par un cycle complet
implémentation → review conformité spec → review qualité de code lors de la
construction de la preview (`docs/superpowers/plans/2026-08-19-landing-redesign-preview.md`).

---

## 01 — Header

- **Objectif** : navigation + identité de marque, accessible partout.
- **Changement visuel** : aucun.
- **Changement UX** : aucun.
- **Fonctionnalités conservées** : `TasteTopbar` réutilisé à l'identique (logo réel `AnimatedLogo`, ticker, 4 liens rapides, `ThemeToggle`, CTA Diagnostic IA).
- **Impact technique** : composant importé tel quel, mêmes props (`ticks`, `liveRows`, `dateMarche`).

## 02 — Market ticker

- **Objectif** : afficher l'activité de séance en continu.
- **Changement visuel** : aucun.
- **Changement UX** : aucun.
- **Fonctionnalités conservées** : `ticks`/`liveRows` calculés par `getPreviewData()`, `NewsTicker` réutilisé tel quel.
- **Impact technique** : requêtes identiques à production, cache distinct (`landing-preview-data` vs `landing-data`).

## 03 — Hero

- **Objectif** : proposition de valeur + preuve produit immédiate.
- **Changement visuel** : **majeur**. Photo + carte d'Afrique + logo BRVM clignotant (`HeroSpotlight`, production) remplacés par un mockup de la vraie interface (`HeroDeviceMockup`, preview) : cadre affichant BRVM-C, 4 cotations réelles, un badge de notation réel.
- **Changement UX** : le produit devient le visuel principal, conformément au mandat et aux 4 images de référence.
- **Fonctionnalités conservées** : mêmes `ticks` déjà calculés, mêmes CTA (`/signup`, `/societes`), même sous-texte de réassurance. `HeroSpotlight.tsx` (production) reste intact et inutilisé par la preview — aucune suppression.
- **Impact technique** : nouveau composant `frontend/components/landing/HeroDeviceMockup.tsx`. Le badge de notation utilise un vrai mover (`hausses[0] ?? baisses[0]`), jamais une valeur inventée (corrigé en review — voir historique git `be7215f`).

## 04 — Trust / Data bar

- **Objectif** : preuve de confiance immédiate (couverture, fraîcheur, méthodologie, sources).
- **Changement visuel** : aucun dans la preview (section non reconstruite — `ProofBand` de production n'est pas encore réutilisée sur `/landing-preview`, cette section reste à porter dans une itération future si la promotion vers `/` est décidée).
- **Changement UX** : sans objet pour l'instant.
- **Fonctionnalités conservées** : sans objet — non porté dans ce lot Phase 10 (limite connue, voir « Hors scope » ci-dessous).
- **Impact technique** : `docs/LANDING_REDESIGN_AUDIT.md` §9 documente déjà le défaut réel de production (`ProofBand` affiche des constantes en dur malgré un commentaire prétendant des « métriques vérifiables ») — à corriger lors du branchement définitif, pas dans cette preview.

## 05 — Marché en direct

- **Objectif** : preuve de fraîcheur des données, activité de la séance.
- **Changement visuel** : **restructuré**. Production : 2 colonnes (texte + carte « séance en direct » listant hausses/baisses ensemble). Preview : grille de 4 cartes côte à côte (Top hausses / BRVM-C + stats / Top baisses / Indices BRVM).
- **Changement UX** : scan plus rapide, chaque catégorie a sa propre carte au lieu d'une liste mélangée.
- **Fonctionnalités conservées** : mêmes données (`hausses`, `baisses`, `nbActions`, `volumeTotal`, `indices`), mêmes routes de sortie (`/societes/{code}`).
- **Impact technique** : `MoverLine` dupliqué dans `landing-preview/page.tsx` (fonction privée non exportée par `page.tsx` de production — duplication délibérée, cohérente avec la convention du projet). Aucun changement de requête.

## 06 — Cartographie / Heatmap

- **Objectif** : vue d'ensemble de toute la cote en un coup d'œil.
- **Changement visuel** : aucun changement de composant, mise en valeur légèrement supérieure dans la nouvelle disposition (juste après la grille 4 cartes plutôt qu'après un bloc 2-colonnes).
- **Changement UX** : aucun.
- **Fonctionnalités conservées** : `LandingHeatmap` + `loadHeatmap()` réutilisés à l'identique — même logique que la page `/heatmap` dédiée, jamais divergée.
- **Impact technique** : aucun changement de code, seule la position dans la page diffère.

## 07 — Outils

- **Objectif** : donner de la visibilité à l'ensemble des fonctionnalités du produit, organisées par intention utilisateur.
- **Changement visuel** : **nouveau**. Grille de 4 catégories (Analyser / Comprendre / Simuler & suivre / Comparer), 16 liens au total.
- **Changement UX** : cette section n'existait pas sous cette forme en production (`AppPreview` s'en approchait avec 6 cartes, sans taxonomie).
- **Fonctionnalités conservées** : chaque lien pointe vers une route réellement vérifiée (`/notations`, `/screener`, `/dividendes`, `/fondamentaux`, `/premium/diagnostic`, `/brief`, `/actualites`, `/analyses`, `/simulateur`, `/premium/paper-trading`, `/parametres/alertes`, `/conseiller`, `/comparateur-sgi`, `/obligations`, `/weekly`, `/liquidite`). Aucun lien « Watchlist » (route non confirmée, délibérément omis).
- **Impact technique** : nouveau composant `frontend/components/landing/ToolsGrid.tsx`, purement statique (aucune requête).

## 08 — Note A–F

- **Objectif** : mettre en avant la fonction signature du produit.
- **Changement visuel** : **nouveau**. Section dédiée avec un exemple réel (le signal au `score_total` le plus élevé de la séance), décomposé en 5 barres.
- **Changement UX** : la note A–F n'existait auparavant qu'en badge inline dans les lignes de movers — jamais mise en avant.
- **Fonctionnalités conservées / honnêteté des données** : **point critique de cette refonte** — les maquettes de référence montraient une décomposition « Fondamentaux/Momentum/Dividende/Valorisation/Risque » qui ne correspond à aucun champ réel. La section utilise la vraie décomposition technique (`score_variation`, `score_volume`, `score_rsi`, `bonus_tendance`, `penalite_liquidite`), avec les bonnes bornes réelles (corrigé en review après un premier bug de normalisation qui figeait toutes les barres à ~50 % — voir git `058d005`).
- **Impact technique** : nouveau composant `frontend/components/landing/RatingSpotlight.tsx`, un fetch `signals_daily` supplémentaire.

## 09 — Diagnostic IA

- **Objectif** : mettre en avant l'outil d'analyse IA premium.
- **Changement visuel** : **nouveau**. Section dédiée avec un extrait d'un vrai rapport.
- **Changement UX** : le Diagnostic IA n'avait auparavant qu'un lien topbar + une mention dans une carte Premium.
- **Fonctionnalités conservées / décision produit** : décision explicite de l'utilisateur (2026-08-19) — **jamais** de génération LLM à la volée sur la landing (coût/latence). Affiche le rapport `diagnostic_reports` le plus récemment généré, avec repli honnête si la table est vide. Bug corrigé en review : le nettoyage markdown de l'extrait effaçait tout tiret ASCII, risquant d'inverser le signe d'un pourcentage négatif (`-3,2 %` → `3,2 %`) — corrigé et extrait en fonction testée (`frontend/lib/landing/excerpt.ts`, 7 tests, git `b4bf504`).
- **Point ouvert, non bloquant** : le rapport affiché est « le plus récent », pas « le plus représentatif » (contrairement à `RatingSpotlight` qui choisit le meilleur signal) — à trancher explicitement si cette section est promue en page publique.
- **Impact technique** : nouveau composant `frontend/components/landing/DiagnosticSpotlight.tsx`, un fetch `diagnostic_reports` (RLS lecture publique déjà en place, migration `0024`).

## 10 — Simulateur

- **Objectif** : preuve par l'exemple, calcul réel.
- **Changement visuel** : aucun (porté à l'identique).
- **Changement UX** : aucun.
- **Fonctionnalités conservées** : calcul réel `simulateInvestment` sur SNTS, 5 ans, 1 000 000 FCFA — logique et JSX copiés fidèlement depuis la production (git `add54b4`).
- **Impact technique** : deux requêtes supplémentaires (`brvm_actions_daily` + `dividends` sur SNTS), identiques à production.

## 11 — SGI

- **Objectif** : différenciateur concret (comparateur de coûts réels).
- **Changement visuel** : aucun (porté à l'identique).
- **Changement UX** : aucun.
- **Fonctionnalités conservées** : `sgiCount`/`sgiPaysLines` calculés en temps réel via `getSgiDirectory()`, jamais codés en dur.
- **Impact technique** : `getSgiDirectory()` appelé hors cache (comme en production) — coût réseau réel à chaque rendu, hérité de production, non aggravé ni corrigé dans ce lot (voir « Risques connus » ci-dessous).

## 12 — Brief quotidien

- **Objectif** : contenu réel, régulièrement renouvelé.
- **Changement visuel** : aucun (porté à l'identique).
- **Changement UX** : aucun.
- **Fonctionnalités conservées** : extrait de `brief_daily`, section masquée si aucun brief disponible.
- **Impact technique** : un fetch supplémentaire, identique à production.

## 13 — Premium (Gratuit vs Premium)

- **Objectif** : différencier clairement l'offre gratuite et payante.
- **Changement visuel** : **nouveau**. Comparatif à 3 colonnes (Gratuit/Premium/Platinium).
- **Changement UX** : en production, un seul lien parmi trois cartes évoquait Premium — jamais de comparatif direct.
- **Fonctionnalités conservées / risque connu** : lit les mêmes tables que `/pricing` (`subscription_plans`, `plan_features`) pour ne jamais raconter une offre différente. **Limite découverte en review** : `/pricing` (`PricingClient.tsx`) n'utilise en réalité PAS `plan_features` aujourd'hui — ses fonctionnalités affichées sont codées en dur, et `plan_features` n'a ni seed ni interface d'administration. Tant que cette table reste vide, la section affichera nom + prix sans liste de fonctionnalités. **Décision produit à prendre avant promotion** : soit construire l'admin `plan_features` et brancher `/pricing` dessus (vraie source unique), soit assumer que la landing reste plus dynamique que `/pricing` tant que cette dette n'est pas résorbée.
- **Impact technique** : nouveau composant `frontend/components/landing/PremiumCompare.tsx`, bug de conversion de prix corrigé en review (`price_monthly` non converti en `Number()`, git `db196dc`).

## 14 — Communauté

- **Objectif** : preuve sociale honnête.
- **Changement visuel** : aucun (porté à l'identique).
- **Changement UX** : aucun.
- **Fonctionnalités conservées** : `SocialProof` réutilisé tel quel — logo BRVM réel, sources réelles, compteur « 2 000+ » (constante éditoriale déjà assumée en production, à tenir à jour manuellement).
- **Impact technique** : aucun.

## 15 — Newsletter

- **Objectif** : capter des inscriptions.
- **Changement visuel** : aucun (porté à l'identique).
- **Changement UX** : aucun.
- **Fonctionnalités conservées** : `NewsletterForm` réutilisé tel quel, `source="landing-preview"` (valeur non contrainte en base, sans risque d'erreur).
- **Impact technique** : aucun.

## 16 — FAQ

- **Objectif** : lever les objections avant conversion.
- **Changement visuel** : aucun (porté à l'identique).
- **Changement UX** : aucun.
- **Fonctionnalités conservées** : `LandingFaq` réutilisé tel quel.
- **Impact technique** : rappel du risque déjà documenté (`docs/LANDING_REDESIGN_AUDIT.md` §8.9) — le JSON-LD `FAQPage` de `layout.tsx` doit rester synchronisé si le texte de la FAQ change un jour ; aucun changement de texte n'a été fait dans ce lot.

## 17 — CTA final

- **Objectif** : dernière incitation à la conversion.
- **Changement visuel** : sans objet — cette section n'a pas été portée dans la preview (non reconstruite dans ce lot, comme `ProofBand`).
- **Note** : le texte cible du mandat (« Votre prochaine décision mérite mieux qu'une intuition ») est **déjà mot pour mot** le texte de production — aucun changement de contenu ne serait de toute façon nécessaire ici.

## 18 — Footer

- **Objectif** : navigation secondaire + mentions légales.
- **Changement visuel** : aucun.
- **Changement UX** : aucun.
- **Fonctionnalités conservées** : `Footer` réutilisé tel quel — structure à 4 colonnes, disclaimer réglementaire verbatim.
- **Risque connu, non corrigé dans ce lot** : `SocialLinks.tsx` a 5 liens sur 6 encore en `href="#"` (bug de contenu préexistant, documenté §8.7 de l'audit — hors périmètre visuel de cette refonte, nécessite les vraies URLs de la part de l'utilisateur).
- **Impact technique** : ajout de `/landing-preview` à `PUBLIC_EXACT` (`frontend/lib/supabase/middleware.ts`) et à `BARE_ROUTES` (`frontend/components/ConditionalShell.tsx`) — sans ces deux ajouts, la page était invisible aux visiteurs anonymes ou rendue dans le mauvais chrome (bug critique découvert et corrigé en review, git `85092d3`).

---

## Sections non portées dans ce lot (limites connues)

- **04 Trust/Data bar** (`ProofBand`) et **17 CTA final** n'ont pas été reconstruits sur `/landing-preview` — la preview couvre 16 des 18 sections du mandat. Ces deux sections sont déjà conformes dans leur contenu (texte du CTA final identique au mandat) et ne présentaient pas d'écart fonctionnel nécessitant une preview séparée ; elles seraient portées telles quelles lors d'une éventuelle promotion vers `/`.

## Risques connus reportés à une itération future (non bloquants pour la preview)

1. **`getSgiDirectory()` non caché** — appel réseau réel à chaque rendu, hérité de production, amplifié par le nombre de sections de la preview (voir review Task 7).
2. **Chaîne de requêtes Supabase séquentielle** dans `getPreviewData()` — plusieurs fetches indépendants pourraient être parallélisés (`Promise.all`) pour réduire le TTFB ; pattern hérité de production, amplifié par les nouvelles sections.
3. **`plan_features` vide, sans UI d'admin** — voir section 13 ci-dessus.
4. **Décision de curation pour Diagnostic IA** — « plus récent » vs « meilleur exemple », voir section 09 ci-dessus.
5. **`SocialLinks.tsx`** — liens sociaux cassés, préexistant, non lié à cette refonte visuelle.

Aucun de ces points n'affecte l'intégrité des données affichées aujourd'hui sur `/landing-preview` — ce sont des optimisations de performance/complétude à traiter avant une éventuelle promotion en production, pas des inexactitudes visibles pour un visiteur.
