# P0 — Résilience ChunkLoadError (app-wide) — Design

**Date :** 2026-07-01
**Statut :** Design validé (périmètre app-wide confirmé)

## Problème

La page `/premium/diagnostic` (bouton vedette « Diagnostic IA » de la navbar) affiche
un écran noir « Application error: a client-side exception has occurred », avec en console :

```
ChunkLoadError: Loading chunk 3872 failed
(/_next/static/chunks/app/premium/diagnostic/page-49402059016c9853.js)
React Error #423
```

## Cause racine (analyse)

Le code des pages diagnostic est sain : ce sont des **server components propres**
(`page.tsx` index et `[code]/page.tsx`), sans `window`/`document`/`localStorage`, sans
import dynamique mal wrappé. Le build local produit bien le chunk (hash actuel
`page-9769d2…js`), différent du hash en erreur (`page-49402059…js`).

→ **ChunkLoadError = chunk périmé après un redéploiement Vercel.** Les hash de chunks
changent à chaque build ; un navigateur qui a en cache une ancienne page HTML (ou navigue
en client-side depuis une vieille version) demande un chunk qui n'existe plus → 404 → crash.
**React #423** (« error while hydrating this Suspense boundary ») en est la **conséquence**,
pas une cause distincte.

C'est un problème **global** (tout redéploiement peut le déclencher sur n'importe quelle
page), d'où le périmètre app-wide.

## Solution

### Fichiers

1. **`app/error.tsx`** (client) — error boundary racine du segment `app`. Couvre toutes les
   routes sous le layout racine.
   - Détecte un ChunkLoadError : `error.name === 'ChunkLoadError'` OU
     `/Loading chunk|ChunkLoadError/i.test(error.message)`.
   - Si ChunkLoadError → recharge la page **une seule fois** (`window.location.reload()`),
     avec un drapeau `sessionStorage` (`wb_chunk_reload`) pour éviter toute boucle de
     rechargement. Récupération transparente pour l'utilisateur.
   - Sinon → UI d'erreur soignée (charte dark) : titre, message court, bouton
     **« Réessayer »** appelant `reset()`, lien retour dashboard.

2. **`app/global-error.tsx`** (client) — capture les erreurs survenant **dans le layout
   racine** (que `app/error.tsx` ne peut pas rattraper). Doit rendre `<html><body>`. Même
   logique ChunkLoadError → reload one-shot ; sinon UI minimale + « Recharger ».

3. **`app/premium/diagnostic/loading.tsx`** (server) — skeleton de la page vedette pendant
   le chargement/navigation : en-tête + grille de cartes en `animate-pulse`.

### Anti-boucle

`sessionStorage['wb_chunk_reload']` : posé avant le reload, retiré au montage réussi d'une
page (dans `error.tsx`/`global-error.tsx`, si le flag est déjà présent on NE recharge PAS et
on affiche l'UI d'erreur classique). Garantit au plus **un** rechargement automatique.

## Ce qui n'est PAS fait (YAGNI)

- Pas de refonte des pages diagnostic (elles sont saines).
- Pas de `dynamic({ ssr:false })` ajouté (aucun composant fautif identifié).
- Pas d'écouteur `window` global supplémentaire : les error boundaries React couvrent le cas
  de rendu ; le reload one-shot suffit.

## Tests / critère de succès

- `npm run build` reste vert (déjà vérifié avant ce lot).
- La page `/premium/diagnostic` se charge sans erreur console.
- En cas de chunk périmé (post-déploiement), l'utilisateur voit au pire un bref rechargement
  automatique, puis la page correcte — plus jamais l'écran « Application error » figé.
- Aucune boucle de rechargement (drapeau sessionStorage).

## Risque

Très faible : ajout de fichiers `error/loading` (mécanisme natif Next.js), aucune
modification des pages ou de la logique existante. Ne touche pas au rendu nominal.
