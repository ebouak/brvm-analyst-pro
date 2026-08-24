# LANDING V2 — DEEP REDESIGN — PREVIEW READY FOR REVIEW

**Branche** : `feature/landing-v2` · **Production** : `origin/main` = `595626b`, **intacte**
**Date** : 2026-08-23 · **Rien n'est mergé, poussé, ni déployé.**

---

## 1. Preview

| Quoi | Où |
|---|---|
| Serveur de production local | `http://localhost:3000` |
| Captures 4 viewports | `docs/landing-v2/apres/{desktop,laptop,tablette,mobile}.png` |
| Script de capture | `frontend/shots.mjs` (Playwright, rejouable) |

Les captures sont hors dépôt (`.gitignore`) : 4 à 5 Mo pièce, aucun intérêt à les versionner.

---

## 2. Ce qui a changé de nature

Le §12 posait un critère d'échec : déplacer les indices, élargir la grille et bouger deux sections ne suffit pas. Voici ce qui a réellement changé.

### Sections qui n'existaient pas

| § | Section | Contenu réel |
|---|---|---|
| 07 | **Secteurs** | 7 secteurs, variation du jour pondérée par la capitalisation |
| 09 | **Comprendre une action** | Les **11 données de séance** d'une fiche société + courbe 60 séances |
| 10 | **Fondamentaux** | CA, résultat net, marge, capitaux propres, dettes, ROE, gearing |
| 13 | **De la donnée à la décision** | La chaîne en 7 étapes, chacune vers une route existante |

### Sections transformées

- **La grille plate de 12 cartes** devient **4 univers** (Analyser / Surveiller / Simuler / Explorer) et **20 outils**.
- **La cartographie** passe d'un tiers de largeur à une section pleine largeur.
- **AppPreview** change de rôle : de « tout ce dont vous avez besoin » (qui répétait la section 14) à « ce qui est gratuit, ce qui est Premium », sa vraie information.
- **Le footer** passe de 3 colonnes fourre-tout à 5 : Produit / Outils / Ressources / Légal / Sources officielles.

---

## 3. Fichiers

### Créés

| Fichier | Rôle | Tests |
|---|---|---|
| `lib/landing/sectors.ts` | Variation sectorielle pondérée | **6** |
| `lib/landing/fundamentals.ts` | Marge, ROE, gearing | **7** |
| `lib/landing/sparkline.ts` | Géométrie SVG des mini-courbes | **6** |
| `lib/landing/memberCount.ts` | Comptage réel des comptes (service-role) | — |
| `lib/landing/latestDiagnostic.ts` | Dernier diagnostic (service-role, RLS) | — |
| `components/landing/SectorStrip.tsx` | Section 07 | — |
| `components/landing/StockSpotlight.tsx` | Section 09 | — |
| `components/landing/FundamentalsPreview.tsx` | Section 10 | — |
| `components/landing/DataToDecision.tsx` | Section 13 | — |
| `components/landing/PlatformUniverses.tsx` | Section 14 | — |
| `components/landing/MoverSparkline.tsx` | Mini-courbes des movers | — |
| `frontend/shots.mjs` | Captures multi-viewports | — |

### Modifiés

`app/page.tsx` (recomposition + couche de données) · `components/Footer.tsx` (5 colonnes) · `components/SocialLinks.tsx` (TikTok, liens morts) · `components/landing/AppPreview.tsx` (redesign) · `ProofBand.tsx` · `PremiumCompare.tsx` · `NewsletterForm.tsx` · `LandingFaq.tsx` · `IndicesCompactCard.tsx`

### Orphelin, conservé

`ToolsGrid.tsx` — remplacé par `PlatformUniverses`. **Ses 12 outils y sont tous**, vérifiés un par un, plus 8 autres. Fichier gardé et marqué, aucune fonctionnalité perdue.

---

## 4. Défauts trouvés en regardant les captures

Aucun n'était visible au typecheck ni aux tests.

| # | Défaut | Cause |
|---|---|---|
| 1 | Le signal BUY/HOLD/SELL ne s'affichait **jamais** | `signals_daily` ne sélectionnait pas la colonne `signal` |
| 2 | « Toute la cote BRVM » affiché **deux fois** | Mon en-tête doublonnait celui de `LandingHeatmap` |
| 3 | Diagnostic IA **vide pour tout visiteur public** | RLS : la clé anon ne voit aucune ligne de `diagnostic_reports` |
| 4 | 6 **emoji** comme icônes | Jurent dans un produit financier institutionnel |
| 5 | Badges de palier **ignorant le thème** | Palette Tailwind brute au lieu des tokens |
| 6 | `260+ obligations` et `48 titres` **figés en dur** | Interdit par le §5 |
| 7 | Cartes Premium avec **liste à puces sans puces** | `plan_features` vide en base |
| 8 | Ordre des colonnes du footer incohérent | LÉGAL en 2ᵉ position |
| 9 | Logos de sources **illisibles** (`h-3.5`) | Trois taches sombres |
| 10 | **5 liens sociaux morts** (`href="#"`) | LinkedIn, X, Instagram, Facebook, YouTube — en production |

---

## 5. Données : tout est réel

| Affiché | Source | Valeur constatée |
|---|---|---|
| Valeur mise en avant | La plus échangée de la séance | **SNTS**, 36 980 FCFA, +7,50 % |
| Fondamentaux | `fundamentals` | SONATEL 2025, CA **1 923,1 Md**, ROE **29,6 %** |
| Secteurs | `brvmSectors.json` × séance | 7 secteurs, de **+5,67 %** à **−3,04 %** |
| Obligations | `brvm_obligations_daily` | **269** lignes cotées |
| Comptes | `profiles` (service-role) | **71** |
| Abonnés TikTok | Déclaré, lié à [@westbourse7](https://www.tiktok.com/@westbourse7) | 5 000+ |
| SGI | `sgi_directory` | 41 SGI, 7 pays |

**Choix expliqué** : la valeur mise en avant est la **plus échangée**, pas la mieux notée. C'est le seul critère qui garantisse des colonnes de séance remplies — ouverture, plus haut et plus bas restent nuls sur un titre qui ne s'est pas traité.

---

## 6. Tests

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | **vert** |
| Tests purs (sparkline, secteurs, fondamentaux) | **19/19** |
| `npm run build` | **vert**, 157/157 pages |
| Routes de la landing | **26/26** existent |
| Liens du footer | **21/21** existent |
| Débordement horizontal (4 viewports) | **aucun** |

### Responsive mesuré

| Viewport | Hauteur | Débordement |
|---|---|---|
| Desktop 1440 | ~8 160 px | non |
| Laptop 1280 | ~8 185 px | non |
| Tablette 834 | ~11 790 px | non |
| Mobile 390 | ~15 990 px | non |

---

## 7. Régressions

**Aucune fonctionnalité supprimée.** Les 12 outils de `ToolsGrid` sont dans `PlatformUniverses`. Footer, disclaimer, FAQ, newsletter, CTA, heatmap, simulateur, SGI, brief, actualités, Premium : tous présents et vérifiés dans le HTML rendu.

Deux comportements **volontairement changés** :
1. Les 5 icônes sociales sans URL ne sont plus rendues. Elles menaient à `#`.
2. Les cartes de formule sans fonctionnalité renvoient vers `/pricing` au lieu d'une liste vide.

---

## 8. Ce qui reste ouvert

| # | Sujet | Qui |
|---|---|---|
| A | **§15 « 2 000+ membres »** : le réel est 71 comptes + 5 000 TikTok. Aucun faux compteur remis. | **toi** |
| B | **`plan_features` vide** en base, aucune interface d'admin pour la peupler | **toi** |
| C | URLs LinkedIn / X / Instagram / Facebook / YouTube | **toi** |
| D | `/contact` n'existe pas — entrée non ajoutée au footer malgré le §23 | **toi** |
| E | Lighthouse non mesuré | à lancer |

---

## 9. Rollback

1. Production non modifiée : `origin/main` = `595626b`.
2. `git checkout main` restaure l'état actuel instantanément.
3. Abandon total : `git branch -D feature/landing-v2`.
4. Après un éventuel merge : `git revert` du commit de merge, ou rollback Vercel en un clic.

---

## 10. Commits

```
c686fb8  fix(footer): ajoute TikTok, masque cinq liens sociaux morts
61437b9  fix(landing-v2): ordre des colonnes du footer et lisibilité des logos
98572f9  feat(landing-v2): footer 5 colonnes + sources, cartes Premium
f823de8  feat(landing-v2): redessine AppPreview (icônes, tokens, compte réel)
edaec21  fix(landing-v2): trois défauts vus sur la capture
1c5fd73  feat(landing-v2): recomposition narrative complète
732c7bb  feat(landing-v2): modules purs et composants de la narration
```

**En attente de ta validation visuelle. Rien ne partira en production sans ton accord.**
