# UI Audit — BRVM Analyst Pro

Date : 2026-05-23  
Méthode : revue de code statique (pas d'accès à l'instance déployée).  
Commit de référence : `2945ea7` (module Rapports livré).

---

## Pages auditées

| Page | Composants analysés |
|---|---|
| `/` Dashboard | `page.tsx`, `KpiCard.tsx`, `TopMovers.tsx` |
| `/actions` | `page.tsx`, `ActionsTable.tsx` |
| `/signaux` | `page.tsx`, `SignalBadge.tsx`, `SignalsTable.tsx` |
| `/backtest` | `page.tsx`, `BacktestChart.tsx`, `BacktestMetrics.tsx` |
| `/reports` | `page.tsx`, `ReportConfig.tsx`, `ReportView.tsx`, sections/ |
| `/portefeuille` | `page.tsx`, formulaires |
| Transversal | `layout.tsx`, `Sidebar.tsx`, `next.config.mjs`, `globals.css` |

---

## Problèmes trouvés & corrections appliquées

### 🔴 Critique

#### 1. `reports/page.tsx` — instruments jamais chargés

**Problème :** Le chargement de la liste des instruments utilisait `useState(() => { ensureInstruments(); })`. `useState` n'exécute pas de callback comme effet de bord — il l'utilise comme valeur initiale, ce qui est ignoré ici. Résultat : la liste des instruments ne se charge jamais, le formulaire reste vide.

**Correction :** Remplacement par `useEffect(() => { ensureInstruments(); }, [ensureInstruments])`.  
**Fichier :** `frontend/app/reports/page.tsx`

---

### 🟠 Important

#### 2. `Sidebar.tsx` — doublon "Rapports" et absence d'indicateur page active

**Problème :** Deux entrées portant le même label "Rapports" (vers `/dashboard/reports` et `/reports`). L'utilisateur ne sait pas laquelle choisir. De plus, aucun indicateur visuel ne distinguait la page courante.

**Corrections :**
- `/dashboard/reports` renommé en "Rapports & Événements".
- Ajout de `usePathname()` pour surligner le lien actif (`bg-up/10 text-up font-medium`).
- Sidebar passé en `'use client'` (requis par `usePathname`).  

**Fichier :** `frontend/components/Sidebar.tsx`

#### 3. `page.tsx` (Dashboard) — label "Volume total" et suffix FCFA

**Problème 1 :** "Volume total" affiché avec `fmtFcfa` (formatage monétaire abrégé), alors que le volume est un nombre de titres (entiers).  
**Problème 2 :** `suffix="FCFA"` passé à `KpiCard` pour "Valeur échangée" alors que `fmtFcfa` n'inclut pas l'unité — pas de doublon réel, mais label redondant avec l'arrondi (ex : "12,3 M FCFA").

**Corrections :**
- Label "Volume total" → "Volume (titres)", format `fmtNumber` (entier).
- Suffix "FCFA" retiré de "Valeur échangée" (la valeur abrégée suffit).  

**Fichier :** `frontend/app/page.tsx`

---

### 🟡 Mineur

#### 4. Titres `<head>` identiques sur toutes les pages

**Problème :** Toutes les pages affichaient "BRVM Analyst Pro" dans l'onglet du navigateur. Pas de SEO ou d'orientation utilisateur.

**Correction :** `layout.tsx` passe au template `'%s | BRVM Analyst Pro'`. Les pages exportent `metadata = { title: '...' }` :
- Dashboard → "Dashboard | BRVM Analyst Pro"
- Actions → "Marché Actions | BRVM Analyst Pro"
- Signaux → "Signaux | BRVM Analyst Pro"
- Backtest → "Backtest | BRVM Analyst Pro"
- Obligations → "Obligations | BRVM Analyst Pro"
- Portefeuille → "Portefeuille & Watchlist | BRVM Analyst Pro"

**Fichiers :** `layout.tsx` + 6 pages.

#### 5. Absence de favicon

**Problème :** Aucun favicon configuré → onglet navigateur avec icône générique.

**Correction :** Favicon SVG `app/favicon.svg` (initiales "BA" sur fond sombre vert), référencé dans `layout.tsx` via `icons: { icon: '/favicon.svg' }`.

#### 6. Absence de security headers HTTP

**Problème :** `next.config.mjs` sans headers de sécurité. Risque de clickjacking (X-Frame-Options), MIME sniffing (X-Content-Type-Options), fuite de Referrer.

**Correction :** Ajout de 4 headers sur toutes les routes :
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

**Fichier :** `frontend/next.config.mjs`

---

## Ce qui n'a PAS pu être audité (sans accès navigateur)

| Aspect | Raison |
|---|---|
| Export PDF Chrome/Firefox | Test fonctionnel requis |
| Recharts dans PDF | Rendu visuel requis |
| Sélecteur multi-titres mobile | Rendu responsive requis |
| Optimistic update watchlist | Comportement réseau requis |
| Courbe d'équité vs B&H distinction visuelle | Rendu Recharts requis |
| Infobulles métriques backtest | Interaction requise |

---

## Ce qui fonctionne bien (d'après le code)

- **États vides** : tous les parcours gèrent explicitement l'absence de données avec un message clair et un appel à l'action (`Lancez npm run scrape:daily`).
- **Couleurs hausse/baisse** : `text-up` (vert) / `text-down` (rouge) cohérents partout, dérivés d'une seule variable Tailwind.
- **Chiffres financiers** : classe `tabular` (JetBrains Mono) appliquée sur tous les montants — alignement propre dans les tableaux.
- **Auth + redirect** : portefeuille redirige vers `/login` si non authentifié, proprement via `redirect()`.
- **`force-dynamic`** : toutes les pages avec données temps réel désactivent le cache Next.js.
- **Gestion null** : `fmtNumber(null)` → "—", cohérent partout.

---

## Score UX global

**6,5 / 10**

| Critère | Note | Commentaire |
|---|---|---|
| Cohérence visuelle | 8/10 | Thème dark cohérent, palette réduite |
| Gestion états vides | 8/10 | Couverts partout avec messages utiles |
| Navigation | 5/10 | Doublon corrigé, indicateur actif manquait |
| Fiabilité fonctionnelle | 5/10 | Bug useEffect critique (corrigé) |
| Titres / SEO | 4/10 | Corrigé (tous identiques avant) |
| Sécurité HTTP | 3/10 | Headers absents (corrigés) |
| Mobile | N/A | Non testé |
| Performance | N/A | Non testé |

**Après corrections appliquées : 7,5 / 10**

Les problèmes restants (infobulles Backtest, PDF mobile) nécessitent des tests fonctionnels en navigateur.
