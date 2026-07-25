# Indice de fraîcheur BRVM — design

**Date** : 2026-07-24
**Statut** : approuvé, prêt pour plan d'implémentation
**Fonctionnalité** : #2 du catalogue produit

## 1. Pourquoi

Un cours affiché sans date induit en erreur : l'utilisateur le croit à jour alors
qu'il peut dater de plusieurs séances si la collecte a décroché. L'indice de
fraîcheur rend visible, à côté des cours, quand la donnée a été collectée pour la
dernière fois et si le rythme normal est tenu.

C'est le pendant, pour les cours, de ce que le passeport (#1) fait pour les
fondamentaux : ne jamais présenter une donnée sans dire d'où et de quand elle vient.

## 2. Cadrage

| Question | Décision |
|---|---|
| Couverture MVP | **Les cours** (marché). Fondamentaux = déjà le passeport ; actualités = plus tard |
| Source de vérité | `scraper_sources.last_success_at` du code `intraday` + `date_marche` max |
| Emplacement | Badge sur le ticker du dashboard et l'en-tête de la fiche action |
| Jours fériés | **Pas de calendrier codé** : on compare la dernière séance en base à aujourd'hui |

## 3. Les deux signaux, déjà en base

Aucune donnée nouvelle à collecter.

- **`scraper_sources`** (`code = 'intraday'`) porte `last_success_at` : l'horodatage
  de la dernière collecte intraday réussie. C'est le monitoring déjà utilisé par
  `/admin/scraping`, exposé ici en lecture au public.
- **`brvm_actions_daily`** : `date_marche` max = la dernière séance présente en base.

## 4. Exposition — migration `0122`

`scraper_sources` est en RLS service-role only (aucune policy de lecture). Plutôt
que d'ouvrir toute la table (qui révélerait les codes internes des autres sources),
on crée une **vue minimale** exposant uniquement ce dont le badge a besoin :

```sql
create or replace view public.v_fraicheur_cours
  with (security_invoker = true) as
select last_success_at as derniere_collecte_intraday
from public.scraper_sources
where code = 'intraday';

-- La vue est security_invoker : elle n'échappe pas à la RLS de la table sous-
-- jacente. On accorde donc explicitement la lecture, et on ajoute une policy de
-- lecture publique sur scraper_sources RESTREINTE à la ligne intraday.
create policy "fraicheur intraday lisible" on public.scraper_sources
  for select using (code = 'intraday');

grant select on public.v_fraicheur_cours to anon, authenticated;
```

`date_marche` max se lit directement sur `brvm_actions_daily`, déjà en lecture
publique.

⚠️ Discipline RLS du projet : vue en `security_invoker` (jamais definer), policy
explicite, et sonde `set role anon` avant merge pour confirmer que **seule** la
ligne intraday fuit — les autres sources (`bdfin-*`, `brvm-news`) restent privées.

## 5. Module pur `lib/freshness.ts`

```ts
export type EtatFraicheur = 'frais' | 'recent' | 'perime' | 'inconnu';

export interface Fraicheur {
  etat: EtatFraicheur;
  derniereSeance: string | null;      // date_marche max (ISO)
  derniereCollecte: string | null;    // last_success_at intraday (ISO)
  ageMinutes: number | null;          // maintenant - derniereCollecte
}

export function computeFreshness(
  derniereCollecte: string | null,
  derniereSeance: string | null,
  maintenant: Date,
): Fraicheur;
```

Règles (seuils dérivés du rythme réel — intraday toutes les 15 min en séance) :

- **inconnu** — pas de collecte tracée (`derniereCollecte` null).
- **frais** — collecte il y a moins de **30 min** ; OU la dernière séance en base
  est aujourd'hui / le dernier jour ouvré et la collecte date de moins de 24 h.
- **recent** — collecte il y a moins de **24 h**, sans être « frais ».
- **perime** — collecte il y a plus de **24 h**. En jour ouvré, c'est un
  décrochage à signaler ; le week-end, l'état reste « frais » si la dernière
  séance en base est bien celle du dernier jour ouvré.

**Point clé anti-fausse-alarme** : on ne crie jamais « périmé » quand la dernière
séance en base correspond à la dernière séance attendue. Un dimanche avec la
clôture de vendredi est « frais », sans calendrier de fériés — si le marché avait
rouvert, une séance plus récente existerait.

## 6. Composant `FreshnessBadge`

Petit, discret, non premium (comme le passeport : la fraîcheur est un argument de
confiance, pas un produit). Rendu :

- **frais** : point vert · « À jour · il y a 8 min »
- **recent** : point neutre · « Hier »
- **perime** : point rouge · « Données périmées depuis 2 j »
- **inconnu** : point gris · « Fraîcheur inconnue »

Au survol / clic : dernière séance, dernière collecte, prochaine attendue (dérivée
du cron : prochaine tranche de 15 min en séance, sinon prochaine ouverture).

Placement MVP : ticker du dashboard et en-tête de `/actions/[code]`.

## 7. Tests purs (`lib/freshness.test.mjs`)

- séance du jour + collecte il y a 8 min un mardi 10 h → **frais**
- collecte il y a 3 h en séance (mardi 14 h) → **perime** (décrochage)
- dimanche, dernière séance = vendredi, collecte vendredi 17 h → **frais**
  (pas d'alarme le week-end)
- `derniereCollecte` null → **inconnu**
- collecte il y a 5 h hors séance, séance du jour à jour → **recent** ou **frais**
  selon la règle des 24 h — cas fixé par un test explicite

## 8. Hors périmètre

- Fraîcheur des fondamentaux (couverte par le passeport) et des actualités
- Page « État des données » dédiée (proche du #20) — le badge contextuel d'abord
- Alertes push sur décrochage — le badge est passif
- Calendrier des jours fériés UEMOA — évité par conception (§5)

## 9. Risques

| Risque | Traitement |
|---|---|
| Fuite d'autres sources par la policy | Policy restreinte à `code='intraday'` + sonde anon |
| Fausse alarme week-end / férié | Comparaison à la dernière séance attendue, pas d'horloge seule |
| Horloge serveur vs séance BRVM (UTC/GMT) | `maintenant` injecté, testé ; la BRVM cote en GMT, pas de décalage |
| `last_success_at` jamais renseigné | État **inconnu** affiché honnêtement, jamais deviné |
