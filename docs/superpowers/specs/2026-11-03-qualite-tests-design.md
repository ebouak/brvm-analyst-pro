# Qualité & Tests — suivi Playwright dans la console admin (V1)

Date : 2026-11-03. Statut : implémenté sur `feat/qualite-tests`, migration
`0186` **non appliquée** (en attente de validation).

## Objectif V1

Tableau de bord **en lecture seule** des tests de bout en bout, en commençant
par le screener. Aucun déclenchement depuis l'admin : les exécutions se lancent
dans GitHub Actions (`e2e.yml`, chaque nuit à 03:00 UTC + lancement manuel).

## Architecture

```
CI (GitHub)                     Site (Vercel)                       Supabase
1. POST /api/qa/ingest/debut ─► exécution « en cours »  ─────────► qa_runs
2. build + Playwright (JSON + HTML)
3. POST /api/qa/ingest/fin   ─► validation, nettoyage   ─────────► qa_importer_run()
   (if: always())               ◄── URL de dépôt signées
4. PUT des pièces jointes  ────────────────────────────────────────► bucket privé qa-artefacts
5. POST …/artefacts/confirmer ─► vérifie la présence réelle, marque « téléversé »
```

- **La CI n'a pas la clé service_role.** Le job compile l'application et exécute
  du code npm tiers. Elle présente `QA_INGEST_SECRET` (≥ 32 caractères, comparé à
  temps constant), qui ne permet que d'écrire des résultats.
- **Le serveur ne fait pas confiance au rapport** : validation zod, normalisation
  pure (`lib/qa/normaliser.ts`), nettoyage des erreurs (`lib/qa/nettoyer.ts` :
  ANSI, JWT, clés `sb_`/`sk-`, Bearer, cookies, paramètres sensibles, e-mails,
  4 000 caractères au plus). stdout/stderr et corps des pièces jointes sont
  retirés dès la CI.
- **Import atomique et idempotent** : `qa_importer_run(jsonb)` verrouille la
  ligne d'exécution ; une exécution close n'est jamais réimportée. Une relance
  GitHub (`run_attempt`) est une nouvelle exécution.
- **Pannes jamais déguisées en succès** :

| Cas | Statut |
|---|---|
| Tests terminés | `termine` |
| Tentative « interrupted » | `interrompu` |
| Build cassé, rapport absent/illisible, erreur hors scénario | `erreur_infra` + motif |
| Runner tué net (aucune fin reçue) | reste `en_cours`, **affiché « incomplet » au-delà de 3 h** (dérivé à la lecture, sans tâche planifiée) |

- **Verdict** (`lib/qa/verdict.ts`) : jamais « succès » si aucun test n'a été
  exécuté (tout ignoré = « aucun test exécuté ») ; une erreur d'infrastructure
  reste une erreur même si des tests ont passé.
- **Statut final ≠ tentatives** : `qa_resultats.statut_final` (réussi, échoué,
  intermittent, ignoré) ; chaque essai, relances comprises, dans `qa_tentatives`.

## Stockage (migration 0186)

`qa_runs`, `qa_resultats`, `qa_tentatives`, `qa_artefacts` ; unicité sur
`(fournisseur, run_id, tentative)`, `(run_id, test_cle)`, `(resultat_id, numero)`,
`chemin`. RLS activée **sans policy**, privilèges retirés à public/anon/authenticated
(modèle des tables admin de 0041). Bucket `qa-artefacts` privé, sans policy,
types limités à PNG/ZIP/WebM, 50 Mo. Permission `qa.read` (super_admin, data_admin).

Conservation : pièces jointes 30 jours, exécutions 180 jours (purge à chaque
import). Aucune donnée personnelle.

## Interface

`/admin/qualite` (dernière exécution, version testée vs `VERCEL_GIT_COMMIT_SHA`,
compteurs, historique paginé filtrable par module/statut/environnement),
`/admin/qualite/[run]`, `/admin/qualite/scenario/[id]` (tentatives, erreur
nettoyée, historique du scénario). Pièces jointes via
`/api/admin/qa/artefacts/[id]` (qa.read + 2FA → URL signée 5 min).
Pas de `loading.tsx` (règle anti-soft-404) : `<Suspense>` dans la page.

## Variables (sans valeurs)

- Vercel (frontend) : `QA_INGEST_SECRET`.
- GitHub : secret `QA_INGEST_SECRET`, variable `QA_INGEST_URL`
  (`https://www.westbourse.com`).

## Limites assumées

- Environnement `ci` : build du commit branché sur la base de production, pas
  le site déployé.
- Les traces Playwright enregistrent les requêtes (donc le cookie d'une session
  de test) : privées, admin seul, purgées à 30 jours.
- Les journaux GitHub Actions d'un dépôt public sont publics (rapporteur `list`).
- Un workflow planifié d'un dépôt public est suspendu par GitHub après 60 jours
  sans activité sur le dépôt.
- **Scénarios Premium du screener ignorés** tant qu'aucune session de test n'est
  fournie : la connexion du site passe par un code e-mail derrière Turnstile, un
  compte à mot de passe ne suffit pas. Décision ouverte (voir la PR).
