# Analyse Fondamentale — Refonte (design)

Date : 2026-06-05
Statut : validé (en attente revue spec)

## 1. Contexte & problème

L'analyse fondamentale vit aujourd'hui dans une app **Streamlit** séparée
(`brvm-scanner.streamlit.app`) qui :
- se met en **veille** après inactivité (Streamlit Community Cloud gratuit) ;
- re-télécharge **localement** cours + PDF à chaque réveil (FS éphémère) → lent,
  fragile, « tombe en erreur ».

Or **toutes les données sont déjà persistées dans Supabase** :
- `fundamentals` : 31 lignes (14 avec CA), extraites des PDF BDFIN ;
- `brvm_actions_daily` : 45 303 cours ;
- `dividends`, `publications`, `brvm_instruments`.

Les fondamentaux extraits sont **peu fiables** (ex. FTSC CA=3, ORAC RN=1678) :
l'extraction PDF par regex/tableaux échoue sur des layouts hétérogènes.

## 2. Décision

**Archiver l'app Streamlit** et intégrer l'analyse fondamentale **dans le site
Next.js** (Vercel, toujours en ligne, lecture Supabase directe). Aucune synchro
éphémère.

## 3. Périmètre

### 3.1 Page `/fondamentaux` (screener)
Tableau comparatif des 48 actions, triable et filtrable par secteur, avec les
ratios clés : PER, P/B, ROE, marge nette, rendement dividende. Le « stock
screener » fondamental.

### 3.2 Bloc enrichi sur `/actions/[code]`
Les 4 familles de ratios + historique pluriannuel + lien PDF source +
bouton de correction manuelle.

### 3.3 Correction manuelle
Modale d'édition des fondamentaux et du nombre d'actions, écrivant dans Supabase
via une route API protégée (service_role côté serveur). Badge « corrigé
manuellement » sur les valeurs éditées.

## 4. Données

### 4.1 Migration `0015_fundamentals_manual.sql`
- `brvm_instruments.shares` (bigint, nullable) — nombre d'actions en circulation
  (indispensable pour PER et P/B). Saisi manuellement.
- `fundamentals.is_manual` (boolean, default false) — marque une ligne corrigée
  à la main (prioritaire sur l'extraction automatique).
- `fundamentals.updated_at` déjà présent.

### 4.2 Source de vérité
Une ligne `fundamentals` par (code, year). Si `is_manual = true`, elle ne doit
jamais être écrasée par le pipeline d'extraction automatique (le push
`push_fundamentals.py` doit exclure les lignes manuelles).

## 5. Calculs — `frontend/lib/fundamentals.ts` (pur, testable)

Toutes les fonctions retournent `number | null` (null si donnée insuffisante).

| Famille | Ratio | Formule |
|---|---|---|
| Valorisation | PER | cours / (RN / shares) |
| | P/B | cours / (equity / shares) |
| | Capitalisation | cours × shares |
| | BPA | RN / shares |
| Rentabilité | ROE | RN / equity |
| | Marge nette | RN / CA |
| Solidité | Gearing | dette / equity |
| Rendement | Rendement div. | dividende / cours |
| | Payout | dividende × shares / RN |
| Croissance | Croissance CA | (CA_n / CA_{n-1}) − 1 |
| | Croissance RN | (RN_n / RN_{n-1}) − 1 |

### 5.1 Garde-fous qualité (best practice — honnêteté)
Fonction `assessQuality(metric, value)` qui classe chaque valeur :
- **ok** : dans une plage plausible ;
- **suspect** : hors plage (ex. CA < 1 000 000 FCFA, ROE > 200 %, PER < 0 ou
  > 1000, marge nette > 100 %) → affiché barré/grisé avec ⚠️ « donnée douteuse » ;
- **missing** : donnée absente → « non disponible » (jamais inventée).

Un ratio dérivé est **suspect** dès qu'une de ses entrées l'est.

## 6. Composants frontend

```
frontend/
├── app/
│   ├── fondamentaux/page.tsx          # screener (server component, lit Supabase)
│   └── api/fundamentals/route.ts      # POST correction manuelle (service_role)
├── components/fundamentals/
│   ├── FundamentalsTable.tsx          # tableau screener triable (client)
│   ├── FundamentalsPanel.tsx          # bloc /actions/[code] (4 familles + histo)
│   ├── RatioCard.tsx                  # carte ratio avec badge qualité
│   └── EditFundamentalsModal.tsx      # correction manuelle
└── lib/
    └── fundamentals.ts                # calculs purs + assessQuality
```

### 6.1 `/actions/[code]`
Le bloc « Fondamentaux » existant (déjà présent) est **remplacé** par
`FundamentalsPanel` : 4 familles de ratios + tableau pluriannuel + lien PDF +
bouton « Corriger ».

## 7. Sécurité
- Lecture : clé anon (RLS publique sur `fundamentals`, `brvm_instruments`).
- Écriture (correction) : route API `/api/fundamentals` côté serveur, utilise
  `SUPABASE_SERVICE_ROLE_KEY` (jamais exposée au client). Authentifiée
  (utilisateur connecté requis).

## 8. Gestion des erreurs / états vides
- Donnée manquante → « non disponible » par ratio (jamais de crash).
- `shares` absent → PER/P/B/capitalisation = « non disponible » + invite à saisir.
- Aucune ligne `fundamentals` pour un code → message + lien vers publications.

## 9. Archivage Streamlit
- `brvm_scanner/` conservé dans le repo mais marqué **DEPRECATED** (README).
- Le lien sidebar « 📑 Analyse fondamentale » pointe désormais vers
  `/fondamentaux` (interne) au lieu de l'URL Streamlit.

## 10. Hors périmètre (YAGNI)
- Pas de DCF / valorisation intrinsèque complexe.
- Pas de prévisions / consensus analystes.
- Pas de ré-extraction PDF améliorée (les garde-fous + correction manuelle
  suffisent).

## 11. Tests
- `lib/fundamentals.ts` : tests unitaires des formules + `assessQuality` sur
  cas plausibles et aberrants (FTSC CA=3 → suspect, etc.).
- Validation manuelle : PER/ROE d'une valeur à fondamentaux fiables (ex. SNTS si
  shares saisi) cohérents avec l'ordre de grandeur connu.
