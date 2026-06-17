# WESTBOURSE — Rebrand & logo animé · Design

> Spec validée le 2026-06-17. Issue du `/brainstorming`.

## 1. Objectif

Renommer le **produit** « BRVM Analyst Pro » en **WESTBOURSE**, déployer le
nouveau logo (monogramme W blanc + flèche montante teal sur fond bleu nuit), et
créer une **animation de tracé** réutilisable pour le splash, le hero de la
landing et les loaders/favicon.

## 2. Règle d'or (périmètre)

- **« BRVM » seul = la Bourse Régionale des Valeurs Mobilières** que l'app
  analyse → **conservé partout** (libellés marché, tableaux, parsers, tables
  `brvm_*`, indices BRVM-C/BRVM-30, etc.).
- **Seul le nom produit** « BRVM Analyst Pro » devient **WESTBOURSE**.
- **Hors périmètre (immuable / historique)** : `supabase/migrations/*`,
  `docs/superpowers/specs/*`, `docs/superpowers/plans/*` et autres docs
  d'archive. On ne réécrit pas l'historique. (Les `docs/` produit comme
  `README.md`, `DEPLOYMENT.md` peuvent être mis à jour, mais ne bloquent rien.)

## 3. Identité visuelle (figée)

Mark vectoriel (viewBox `0 0 130 105`) :

- **W blanc** (3 traits) : `M16 24 L40 82 L58 48 L76 82` — stroke `#ffffff`,
  largeur 12, bouts/joints ronds.
- **Hampe teal** : `M76 82 L100 33` — stroke `#16b6a4`, largeur 12.
- **Pointe** (triangle plein) : polygone `110,12 117,40 86,28` — fill `#16b6a4`.
- **Fond** (optionnel) : rect arrondi bleu nuit `#0c1d2e`, rayon ~22 % de la
  taille.
- **Wordmark** : « WESTBOURSE », Inter 700, letter-spacing `.42em`, `#f4f6f8`.

## 4. Composant `<AnimatedLogo />`

`frontend/components/brand/AnimatedLogo.tsx` — CSS pur (pas de framer-motion),
donc utilisable en Server Component.

```ts
interface AnimatedLogoProps {
  size?: number;                       // px du mark (défaut 48)
  variant?: 'mark' | 'lockup';         // mark seul | mark + wordmark (défaut 'mark')
  animate?: boolean;                   // joue le tracé (défaut true)
  loop?: boolean;                      // boucle (loader/splash) | one-shot (défaut false)
  background?: boolean;                // boîte bleu nuit arrondie (défaut true)
  className?: string;
}
```

Séquence de tracé (~1,8 s), via `stroke-dasharray`/`stroke-dashoffset` +
keyframes :

1. W blanc se dessine `0 → 0,9 s`.
2. Hampe teal se dessine `0,9 → 1,3 s`.
3. Pointe triangle « pop » (opacity 0→1, scale 0,2→1) `1,3 → 1,6 s`.
4. `loop` : pause 0,8 s puis reprise.

**Accessibilité** : `@media (prefers-reduced-motion: reduce)` → rendu statique
immédiat (dashoffset 0, pointe visible). `role="img"` + `aria-label="WESTBOURSE"`.

`onDone` n'est PAS exposé (CSS pur, pas de cycle JS) — le splash gère son retrait
par timer interne (voir §5).

## 5. Usages

| Contexte | Fichier | Détail |
|---|---|---|
| **Splash** | `frontend/components/brand/SplashScreen.tsx` (client) | Overlay plein écran `#0c1d2e`, `<AnimatedLogo size={96} variant="lockup" loop={false} background={false}/>`. Retiré après ~2,2 s (timer). `sessionStorage['ws_splash_seen']` pour ne jouer qu'une fois par session. Respecte `prefers-reduced-motion` (retrait immédiat). Monté dans `app/layout.tsx`. |
| **Hero landing** | intégration dans le hero existant (`components/landing/taste/` ou `app/page.tsx`) | `<AnimatedLogo variant="lockup" animate loop={false} background={false}/>` remplaçant le visuel logo actuel. |
| **Loader inline** | `<AnimatedLogo size={24} variant="mark" loop background={false}/>` | Réutilisable comme spinner de marque. |
| **Favicon / icône PWA** | `public/icon.svg` (statique) | Export statique du mark sur fond `#0c1d2e`. Sert aussi `manifest.json` + favicon. |

## 6. Remplacement de `BrandLogo.tsx`

`components/landing/taste/BrandLogo.tsx` (ancien SVG checkmark cyan + label
« BRVM Analyst Pro ») est réécrit pour rendre le nouveau mark statique + wordmark
« WESTBOURSE ». Tous ses consommateurs (topbar, footer, admin shell) héritent
automatiquement. `aria-label` → `"WESTBOURSE"`.

## 7. Rebrand textuel

~58 fichiers runtime sous `frontend/` contiennent « BRVM Analyst Pro ». Chaque
occurrence du **nom produit** → « WESTBOURSE ». Catégories :

- **Métadonnées / SEO** : `app/layout.tsx`, `app/*/page.tsx` (`title`,
  `description`, `openGraph`), routes `app/api/og/*`.
- **Assets PWA** : `public/manifest.json`, `public/sw.js`, `public/icon.svg`.
- **Emails** : `lib/email/templates.ts`, `app/api/newsletter/*`.
- **Exports** : `lib/export/{xlsx.ts,pdfTemplate.tsx,docxTemplate.ts}`,
  `app/reports/export/ReportPDF.tsx`, `app/actions/[code]/print`.
- **Légal** : `app/{cgu,mentions-legales}/page.tsx`, `lib/legal/disclaimer.ts`
  (⚠️ vérifier la raison sociale juridique : si « BRVM Analyst Pro » désigne
  l'entité légale, garder le nom légal et n'adapter que la marque commerciale —
  à confirmer au moment de l'édition, ne pas inventer d'entité).
- **UI** : `components/Footer.tsx`, `TasteTopbar.tsx`, `AdminShell.tsx`,
  `SignInClient.tsx`, pages diverses.
- **package.json** : champ `name` (slug technique — `westbourse` ; ne casse
  rien côté déploiement Vercel).

**Prudence** : pour chaque fichier, vérifier que l'occurrence est bien le **nom
produit** et pas « BRVM » (bourse). Ne jamais remplacer « BRVM » isolé.

## 8. Tests / vérification

- `cd frontend && npx tsc --noEmit` → vert après chaque lot.
- `cd frontend && npm run build` → vert en fin de rebrand.
- Contrôle visuel : splash joue une fois/session ; hero anime au chargement ;
  favicon affiche le nouveau mark ; `prefers-reduced-motion` rend statique.
- `grep -ri "BRVM Analyst Pro" frontend/` → ne renvoie plus que d'éventuels
  faux positifs justifiés (entité légale documentée).

## 9. Hors périmètre

- Pas de changement de domaine ni de logique métier.
- Pas de réécriture des migrations ni des specs/plans d'archive.
- Pas de nouvelle dépendance (animation en CSS pur).

## 10. Découpage d'implémentation (aperçu)

1. `AnimatedLogo.tsx` + rendu statique + anim CSS (+ reduced-motion).
2. `BrandLogo.tsx` réécrit (mark statique).
3. Assets : `icon.svg`, `manifest.json`, `sw.js`.
4. `SplashScreen.tsx` + montage `layout.tsx`.
5. Hero landing : intégration de l'anim.
6. Rebrand textuel par lots (métadonnées → emails/exports → légal → UI).
7. `tsc` + `build` + contrôle visuel.
