# Journal de décision — design

**Date** : 2026-07-26
**Statut** : approuvé, prêt pour plan d'implémentation
**Fonctionnalité** : #10 du catalogue produit

## 1. Pourquoi, et ce qui existe déjà

Objectif : permettre à l'utilisateur d'apprendre de ses choix — noter sa thèse
d'investissement, puis la clôturer avec un bilan a posteriori.

**Une grande partie existe déjà** et ne sera PAS reconstruite :

- Table `investment_theses` (migration `0051`) : `user_id`, `code`, `stance`
  (achat/conserver/vente), `cours_reference`, `objectif`, `horizon`, `these`
  (raisonnement), `points` (jsonb, points-clés à suivre), timestamps.
- RLS **owner-strict** : `auth.uid() = user_id`.
- RGPD **déjà câblé** : `/api/account/export` et `/api/account/delete` couvrent
  `investment_theses`.
- API `/api/theses` (GET/POST/DELETE) + `ThesisPanel` sur la fiche action.
- Logique pure `lib/theses/status.ts` : `checkThesis`, types `Stance`,
  `ThesisStatus` — l'état vivant d'une thèse vs le cours courant.

Construire une table `decision_journal` séparée dupliquerait tout cela. Le design
**étend** l'existant.

## 2. Le manque : le bilan a posteriori

`investment_theses` est une thèse *vivante* : une par titre, éditée en place. Il
n'existe :

- aucun champ de **bilan / clôture** (verdict, retour a posteriori) ;
- aucun **historique** — rééditer écrase ;
- aucune **page centrale** pour revoir ses décisions et ce qu'elles ont donné.

C'est précisément ce qui porte la note de rétention 5/5 du catalogue.

## 3. Décisions de cadrage

| Question | Décision |
|---|---|
| Bilan | **Clôture + archive historisée** : statut active/clôturée, verdict, bilan |
| Historique | Une thèse **active** par titre ; les clôturées s'accumulent |
| Cours de clôture | **Automatique** : dernier cours de `brvm_actions_daily`, jamais saisi |
| #15 (alerte thèse invalidée) | Hors périmètre — préparé, pas implémenté |

## 4. Migration `0123`

```sql
alter table public.investment_theses
  add column if not exists statut        text not null default 'active'
       check (statut in ('active','cloturee')),
  add column if not exists verdict       text
       check (verdict in ('jouee','invalidee','abandonnee')),
  add column if not exists bilan         text,
  add column if not exists cours_cloture numeric(18,4),
  add column if not exists cloturee_le   timestamptz;
```

**Conséquence sur l'unicité** — l'archive historisée exige de lever
`unique(user_id, code)` (qui interdirait une nouvelle thèse après clôture) au
profit d'un **index partiel** : une seule thèse *active* par titre, autant de
clôturées qu'on veut.

```sql
alter table public.investment_theses
  drop constraint if exists investment_theses_user_id_code_key;
create unique index if not exists uniq_these_active
  on public.investment_theses (user_id, code) where statut = 'active';
```

⚠️ La RLS `theses_owner_all` existante couvre déjà les nouvelles colonnes (elle
porte sur la ligne, pas les colonnes). Rien à recâbler côté RLS.

## 5. Conséquence sur le POST — à ne pas manquer

Le POST actuel fait `upsert(row, { onConflict: 'user_id,code' })`. **Cet upsert
casse** avec un index partiel : supabase-js ne peut cibler qu'une contrainte par
noms de colonnes, pas un index partiel avec prédicat.

Le POST devient donc : chercher la thèse **active** de `(user, code)` → la mettre
à jour si elle existe, sinon insérer. La création d'une nouvelle thèse sur un
titre dont l'ancienne est **clôturée** fonctionne alors naturellement (l'index
partiel ne bloque que sur une active existante).

## 6. Module pur `lib/journal/bilan.ts`

Réutilise `Stance` de `lib/theses/status.ts` (pas de redéfinition).

```ts
import type { Stance } from '@/lib/theses/status';

export interface BilanInput {
  stance: Stance;
  coursReference: number | null;
  objectif: number | null;
  coursCloture: number;
}

export interface Bilan {
  performancePct: number | null;      // (cloture - reference) / reference
  objectifAtteint: 'oui' | 'non' | 'sans-objet';
  verdictCoherent: boolean | null;    // le verdict de l'utilisateur colle-t-il aux chiffres ?
}

export function computeBilan(i: BilanInput, verdict: string): Bilan;
```

L'écart est **calculé, jamais saisi**. `verdictCoherent` compare le verdict de
l'utilisateur au mouvement réel (une thèse « achat » clôturée « jouée » alors que
le cours a chuté est signalée incohérente) — sans jamais réécrire le choix de
l'utilisateur, seulement le signaler. `performancePct` = null si `coursReference`
absent ou nul (pas de division par zéro).

## 7. Clôture — `POST /api/theses/[id]/cloturer`

Corps : `{ verdict, bilan }`. Le serveur :

1. vérifie que la thèse appartient à l'utilisateur (RLS + contrôle explicite) et
   qu'elle est `active` ;
2. lit le dernier cours de `brvm_actions_daily` pour le code ;
3. écrit `statut='cloturee'`, `verdict`, `bilan`, `cours_cloture`, `cloturee_le`.

Idempotent : clôturer une thèse déjà clôturée renvoie une erreur claire.

## 8. Page `/journal`

- **Thèses actives** : éditables, avec la performance latente courante
  (`checkThesis` existant) et un bouton « Clôturer ».
- **Historique clôturé** : verdict, bilan, `performancePct` figée, objectif
  atteint ou non.
- **Bandeau de stats honnêtes** : nombre de thèses jouées / invalidées /
  abandonnées. Aucun chiffre inventé ; « aucune thèse clôturée » si vide.

Entrée de menu dans le groupe Gestion (`lib/nav.ts`).

## 9. Tests

**Purs** (`lib/journal/bilan.test.mjs`) :

- « achat », référence 100, clôture 130 → performance +30 %, verdict « jouée »
  cohérent
- « achat », clôture 80, verdict « jouée » → `verdictCoherent = false`
- « vente », clôture 80 (baisse) verdict « jouée » → cohérent (la baisse valide
  une vente)
- objectif 120, clôture 130 → `objectifAtteint = 'oui'`
- `coursReference` nul → `performancePct = null`, aucun plantage

**RLS** (sonde `set role`/deux utilisateurs) : un utilisateur ne lit ni ne
clôture la thèse d'un autre.

**RGPD** : vérifier que l'export inclut les nouvelles colonnes (il fait
`select('*')`, donc automatique — mais confirmé par lecture du fichier).

## 10. Hors périmètre

- #15 alerte automatique « thèse invalidée » — le verdict `invalidee` prépare le
  terrain, l'alerte proactive fera sa propre spec.
- Rappels planifiés sur les déclencheurs (`points`).
- Partage / export public d'une thèse.

## 11. Risques

| Risque | Traitement |
|---|---|
| Upsert POST cassé par l'index partiel | Réécriture update-active-sinon-insert (§5) |
| Perte de l'unicité → deux thèses actives | Index partiel testé par une insertion en double |
| Cours de clôture absent (titre sans cotation) | Clôture refusée avec message clair, plutôt qu'un bilan sans écart |
| Nouvelles colonnes hors export RGPD | `select('*')` les couvre ; vérifié au plan |
