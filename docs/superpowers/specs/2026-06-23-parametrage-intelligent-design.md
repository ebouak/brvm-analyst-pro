# A · Paramétrage intelligent — Design

**Date :** 2026-06-23 · **Statut :** Validé (maquette approuvée)
**Sous-projet 1/3** (A → C → B). Voir aussi : dashboard builder (B), report builder (C).

## Objectif
Des préférences utilisateur qui **personnalisent réellement** l'app (pas du cosmétique) :
secteurs favoris → section dashboard + actus ; fréquence du brief ; toggles de
notifications. **Devise : FCFA conservée** (pas de conversion).

## Données
`profiles.preferences` (jsonb, déjà créé migration 0056) :
```json
{
  "briefFrequency": "daily" | "weekly" | "off",
  "notify": { "signaux": bool, "briefHebdo": bool, "alertesPrix": bool, "actus": bool }
}
```
+ `profiles.favorite_sectors` (text[], déjà créé).

## Ce qui pilote l'app (v1)
1. **Dashboard — section « Vos secteurs »** : cartes des secteurs favoris (perf moy
   + meilleur/pire titre), réutilise l'agrégation `lib/sectors`. Si `favorite_sectors`
   vide → invite à en choisir (lien /profil).
2. **Actus — « Vos actus »** : badge/priorisation des news dont `instrument_code`
   appartient à un secteur favori (mapping code→secteur via `brvm_instruments`).
3. **Brief hebdo** : le toggle `notify.briefHebdo` (dé)abonne RÉELLEMENT
   `newsletter_subscribers` (réutilise `/api/newsletter/subscribe` + unsubscribe).
4. **Notif par type (signaux, alertesPrix)** : préférences STOCKÉES + UI prête,
   libellées « activé — livraison bientôt » (le moteur d'envoi par-utilisateur
   n'existe pas encore → honnêteté, pas de fausse promesse).

## Composants & fichiers
| Fichier | Rôle |
|---|---|
| `lib/preferences/sectors.ts` | `pickFavoriteSectorPerf(perfs, favorites)` (pur) + test |
| `components/profile/PreferencesSection.tsx` | UI réglages sur /profil (client) |
| `app/profil/page.tsx` | intègre PreferencesSection (modif) |
| `app/api/profile/route.ts` | déjà : PATCH `preferences` (whitelist OK) |
| `components/dashboard/FavoriteSectors.tsx` | section « Vos secteurs » (client/serveur) |
| `app/dashboard/page.tsx` | charge favorite_sectors + rend FavoriteSectors (modif) |

## Fonction pure
```ts
// lib/preferences/sectors.ts
import type { SectorPerf } from '@/lib/sectors';
/** Filtre + ordonne les perfs sur les secteurs favoris (ordre des favoris). */
export function pickFavoriteSectorPerf(perfs: SectorPerf[], favorites: string[]): SectorPerf[];
```

## Flux
- /profil : PreferencesSection lit `preferences` + `favorite_sectors` (props depuis
  la page serveur) → PATCH `/api/profile` au save ; le toggle briefHebdo appelle
  aussi `/api/newsletter/subscribe` ou `/api/newsletter/unsubscribe`.
- /dashboard : la page serveur lit `favorite_sectors` du profil (session) + agrège
  les secteurs (pattern /secteurs paginé) → `pickFavoriteSectorPerf` → FavoriteSectors.

## Edge cases
- Profil sans préférences → défauts (`briefFrequency:'weekly'`, tous toggles off
  sauf actus). favorite_sectors vide → section dashboard en mode invite.
- Utilisateur non connecté sur /dashboard → pas de section « Vos secteurs ».

## Tests (vitest)
`lib/preferences/sectors.test.ts` : filtre par favoris, conserve l'ordre des
favoris, ignore un favori sans perf, liste vide → [].

## Hors périmètre (YAGNI / autres sous-projets)
- Conversion de devise EUR/USD.
- Moteur d'envoi de notifications **par utilisateur** (signaux/alertes prix) — la
  livraison réelle est un chantier séparé ; ici on stocke + on câble la newsletter.
- Dashboard builder (B) et report builder (C) — sous-projets distincts.
