# Performance — audit des 31 règles (2026-11-16)

Branche `perf/audit-31-regles`. Chaque règle corrigée = un commit, vérifié par
typecheck, tests (3 308), build de production et appli lancée contre un faux
Supabase (pages, vrais 404, parcours connecté, mur Premium, e2e non connectés).

## Mesurer

```bash
cd frontend && npm run build && npm run start      # autre terminal
npm run perf:mobile                                  # local, 3 passages
PERF_BASE=https://www.westbourse.com PERF_PASSAGES=5 npm run perf:mobile
PERF_LCP_MAX=4000 npm run perf:mobile                # code 1 au-delà
```

Conditions : mobile 412×915, CPU ×4, 4G lente (150 ms, 1,6 Mb/s), cache vide,
médiane. Rapporte FCP, LCP, JS téléchargé, et la pire durée d'événement d'une
saisie dans /actions (proxy de l'INP). Voir `frontend/scripts/perf-mobile.mjs`.

## Fait

| Règle | Où | Effet mesuré |
|---|---|---|
| 1 Squelettes | `/dashboard`, listes `(liste)/loading.tsx`, fiche action (Suspense après le contrôle 404) | base à 300 ms : LCP /dashboard 4 360 → 3 856 ms, /actions/[code] 5 112 → 4 760, /actions 4 140 → 3 744 |
| 2 Images | photos d'activité en WebP | 2,3 → 1,6 Mo |
| 3 Doublons | `lib/supabase/session.ts` (React `cache`), middleware `getClaims()` | fiche action : ~8 appels Supabase Auth → 1 |
| 10 Cache | données de marché du tableau de bord, `unstable_cache` 60 s | ~10 requêtes en moins par visite |
| 11 Dépendances | 5 paquets jamais importés retirés | installation / CI |
| 12 Timeouts | Turnstile, Resend, vidéo de l'accueil, Telegram, WhatsApp, LinkedIn/TikTok | plus de page bloquée par un tiers lent |
| 15 Lazy load | 17 `<img>` de listes | — |
| 16 Parallèle | fiche action en deux vagues (`lib/async/demarrer.ts`) | ~20 attentes en série → 2 vagues |
| 22 JS par page | three.js, ExcelJS, html-to-image, Recharts à la demande | /login 537 → 312 Ko ; /actions/[code]/financials 565 → 307 Ko |
| 24 Colonnes | historique de la fiche action (600 lignes) | 16 colonnes au lieu de toutes |
| 26 Re-renders | mesuré, rien à corriger | pire événement 48-56 ms à CPU ×4 |
| 27 Cache navigateur | images/vidéos de `public/` : 1 jour + SWR 7 j (`/api` exclu) | plus de revalidation à chaque visite |
| 29 Polices | Geist, Geist Mono, Instrument Serif en fichiers locaux | Geist n'est plus téléchargée deux fois |
| 31 Téléphone lent | `npm run perf:mobile` | — |

Déjà en place avant l'audit : 5, 6, 7, 8, 9, 13, 14, 17, 18, 19, 21, 28, 30.
Sans objet : 4 (recherches filtrées en local), 23 (~48 lignes), 25 (pool géré
par l'API Supabase).

## Reste à décider

- **Règle 20 — rendu statique.** Les 317 routes sont dynamiques parce que
  `app/layout.tsx` lit la session (coquille connectée, Premium, onboarding).
  Les rendre statiques suppose de lire la session côté navigateur, avec un
  clignotement de la navigation pour les membres connectés. Le cache de
  données (règle 10, `bisData`) couvre déjà l'essentiel du coût serveur.
- **Squelette de /dashboard.** Retiré le 2026-11-03 (LCP 12 s sous Next 14),
  remis après nouvelle mesure en conditions reproduites. À confirmer sur les
  Core Web Vitals réels (Sentry) après mise en production.
- **Splash de marque** (1,2 s, première visite de chaque session). Ne bloque
  pas les clics, mais recouvre la page pendant le premier affichage.
- **Middleware `getClaims()`** : un compte supprimé passe le mur jusqu'à
  l'expiration de son jeton (1 h max) ; pages et API revérifient côté serveur.
