# Academy P2 — examens de niveau & certificats partageables

**Date** : 2026-07-21 · **Statut** : approuvé (brainstorming)

Décisions utilisateur : un examen par **niveau** (4 certificats possibles) · questions =
**mix** quiz des leçons + questions inédites de synthèse · **tentatives illimitées** avec
tirage aléatoire + réponses mélangées · seuil **≥ 70 %** · certificat = **page publique
vérifiable avec nom complet**, donc **consentement explicite** requis · examen **débloqué
après avoir terminé les leçons du niveau** · certificat **révocable**.

## 1. Contexte & existant

- `academy_courses` (slug, titre, `niveau` ∈ {debutant, intermediaire, avance, expert},
  `content` jsonb `{intro, lessons[], glossaire[]}`). Un cours = un niveau. RLS lecture
  publique des cours publiés.
- `academy_progress` (user_id, course_id, lesson_idx, completed, quiz_score, quiz_passed) —
  RLS owner-strict. `academy_notes`, exercices (`exercice_passed`) idem.
- Accès Academy gardé par `canAccess('formations')` (premium). Les codes B2B (P4)
  donneront cet accès aux non-premium plus tard — **hors scope ici**.
- Quiz par leçon déjà présents dans `content.lessons[].qcm`.
- Précédents réutilisables : `ImageResponse` (routes `app/api/og/*`), pattern RLS
  owner-strict, `GET /api/account/export` + `DELETE /api/account/delete`.

**Écart RGPD préexistant constaté** : `academy_progress`/`academy_notes` (0109/0110) ne
figurent PAS dans export/delete. Cette spec les ajoute en même temps que les nouvelles
tables — sinon la fonctionnalité aggraverait le trou.

## 2. Modèle de données (migration `0112_academy_exams_certificats.sql`)

### 2.1 `academy_exam_questions` — banque de questions

```
id           uuid pk default gen_random_uuid()
niveau       text not null check (niveau in ('debutant','intermediaire','avance','expert'))
question     text not null
options      jsonb not null         -- string[] (2..5)
correct      int  not null check (correct >= 0)
explication  text not null
source       text not null check (source in ('quiz','inedite'))
active       boolean not null default true
created_at   timestamptz not null default now()
```

**RLS activée, AUCUNE policy de lecture** (ni public, ni authenticated). La table n'est
lue que côté serveur via le service client, jamais exposée : c'est ce qui protège les
réponses. `revoke insert, update, delete … from public, anon, authenticated`.

Seed : script d'import qui (a) parcourt les leçons de chaque cours-niveau et insère leurs
`qcm` en `source='quiz'`, (b) insère les questions inédites de synthèse en
`source='inedite'`. Ces inédites sont **rédigées** pour l'examen ; on peut en récupérer
une partie des 12 QCM de l'ancienne édition, qui ne sont plus dans le source vivant mais
dans l'historique git : `git show b7c3d9d:frontend/public/academy/index.html` (extraire le
bloc `QCM_DATA`). Idempotent (dédoublonnage par hash question+niveau).

### 2.2 `academy_exam_attempts` — passages

```
id           uuid pk default gen_random_uuid()
user_id      uuid not null references auth.users(id) on delete cascade
niveau       text not null check (niveau in (...))
question_ids uuid[] not null        -- questions tirées pour cette tentative
score        int not null check (score between 0 and 100)
passed       boolean not null
created_at   timestamptz not null default now()
```

RLS owner-strict (select/insert `user_id = (select auth.uid())`). `updated_at` inutile
(un attempt est immuable). Index `(user_id, niveau, created_at desc)`.

### 2.3 `academy_certificates` — certificats

```
id            uuid pk default gen_random_uuid()   -- sert d'URL publique
user_id       uuid not null references auth.users(id) on delete cascade
niveau        text not null check (niveau in (...))
display_name  text not null                        -- nom confirmé par l'utilisateur
consent_at    timestamptz not null                 -- horodatage du consentement RGPD
issued_at     timestamptz not null default now()
revoked       boolean not null default false
unique (user_id, niveau)                            -- un certificat par niveau
```

RLS :
- lecture **publique** limitée aux non-révoqués : `for select using (revoked = false)`.
  ⚠ la page publique ne SELECT que `id, niveau, display_name, issued_at` — jamais
  `user_id`. (Le `user_id` reste dans la table mais n'est pas exposé par la requête
  publique ; il sert au propriétaire et à la cascade.)
- gestion par le propriétaire : `for all using (user_id = (select auth.uid()))` (créer,
  révoquer). L'insert vérifie qu'un attempt `passed` existe pour ce niveau (contrôle
  applicatif côté route + non contournable car insert passe par une route serveur qui
  revérifie).

Note : la lecture publique et la policy owner coexistent ; le risque est qu'un anon lise
`user_id`. On l'empêche en **ne sélectionnant jamais `user_id` dans la requête publique**
et en testant à la sonde anon qu'un `select=user_id` … ne fuite pas (la colonne existe
donc PostgREST la renverrait si demandée). **Décision** : créer une **vue**
`academy_certificates_public` en `security_invoker=true` exposant seulement
`id, niveau, display_name, issued_at` (filtrée `revoked=false`), et faire la lecture
publique sur la vue. La table elle-même : lecture publique retirée, seule la policy owner
subsiste. Ainsi anon ne voit jamais `user_id`.

## 3. Assemblage & correction de l'examen (serveur uniquement)

### 3.1 Logique pure (`lib/academy/exam.ts`, testée)

- `assembleExam(banque, seed, taille=20)` : tire `taille` questions au hasard (sans
  doublon) via un PRNG seedé (déterministe pour le test), mélange l'ordre des options de
  chaque question en gardant trace de la position correcte. Retourne
  `{ question_ids, questions: [{id, question, options}] }` **sans `correct`**.
- `gradeExam(banque, question_ids, reponses)` : recalcule le score serveur (bonnes
  réponses / total × 100), `passed = score >= 70`. Pur.

### 3.2 Routes

- `POST /api/academy/exam/[niveau]/start` : `requireUser` + `canAccess('formations')` +
  vérifie que toutes les leçons du cours-niveau sont `completed`. Charge la banque
  (service client), `assembleExam`, insère un attempt « en cours » n'est PAS nécessaire —
  on renvoie `question_ids` + questions au client ; le client renverra ses réponses.
  (Anti-triche suffisant : les `correct` ne partent jamais.)
- `POST /api/academy/exam/[niveau]/submit` : reçoit `question_ids` + `reponses`, recharge
  la banque, `gradeExam`, insère l'attempt (score, passed), renvoie score + corrigé
  (questions, bonne réponse, explication) pour l'affichage pédagogique.

### 3.3 UI

- Page `/formations/academy/examen/[niveau]` (client) : intro (règles, 70 %, illimité),
  puis questions une à une avec barre de progression, puis écran résultat (score,
  réussite/échec, corrigé question par question). Si `passed` et pas encore de
  certificat → CTA « Générer mon certificat ».
- Entrée depuis le hub Academy : bouton « Passer l'examen » sur chaque cours-niveau
  terminé (sinon désactivé avec « Terminez les leçons pour débloquer »).

## 4. Certificat & partage (avec consentement)

### 4.1 Génération

- `POST /api/academy/certificate` : `requireUser`, vérifie un attempt `passed` pour le
  niveau, exige `{ display_name, consent: true }`. Sans `consent`, 400. Upsert
  `academy_certificates` (`consent_at = now()`). Le `display_name` est **saisi/confirmé
  par l'utilisateur** (pré-rempli depuis `profiles` si dispo) — jamais forcé.
- Écran de génération : champ nom (pré-rempli, éditable) + case à cocher explicite
  « J'accepte que mon nom et ce certificat figurent sur une page publique vérifiable, et
  je peux le révoquer à tout moment. » Bouton actif seulement si cochée.

### 4.2 Page publique & OG

- `/certificat/[id]` : server component. Lit la **vue** `academy_certificates_public`
  (anon). 404 si absent/révoqué. Rend un certificat charté (nom, niveau, date, mention
  « vérifié par WESTBOURSE », le `id` comme référence). `generateMetadata` pour le partage.
- `/certificat/[id]/opengraph-image` : `ImageResponse` (pattern `app/api/og/*`) — image
  PNG du certificat (nom, niveau, date) que LinkedIn/WhatsApp afficheront en aperçu.
- Bouton **« Ajouter à LinkedIn »** : lien
  `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=<Niveau>&organizationName=WESTBOURSE&issueYear=<Y>&issueMonth=<M>&certUrl=<url>&certId=<id>`.
  Plus boutons de partage (copier le lien, WhatsApp).

### 4.3 Révocation

- Depuis `/account` ou la page perso Academy : liste des certificats + bouton « Révoquer »
  → `PATCH /api/academy/certificate/[id]` (owner) met `revoked=true`. La page publique
  renvoie alors 404. Réversible (regénérable).

## 5. RGPD (checklist)

- **Données** : `display_name` (nom, perso), `niveau`, dates, résultats d'examen.
- **Finalité** : délivrer et vérifier un certificat de formation partageable.
- **Base légale** : **consentement** (`consent_at`), matérialisé par la case avant
  génération. Le simple fait de passer un examen n'expose rien (attempts = RLS owner).
- **Conservation** : tant que le compte est actif ; révocation possible à tout moment.
- **Droits câblés** (dans la même migration/PR) :
  - `GET /api/account/export` : ajouter `academy_progress`, `academy_notes`,
    `academy_exam_attempts`, `academy_certificates` (corrige aussi l'écart préexistant).
  - `DELETE /api/account/delete` : ajouter ces tables à la liste supprimée par `user_id`
    (les FK `on delete cascade` couvrent déjà, mais on liste explicitement pour la
    lisibilité et le cas admin).
- **Sécurité** : banque de questions jamais exposée (RLS sans lecture) ; page publique via
  vue `security_invoker` n'exposant pas `user_id` ; service-role server-only.

## 6. Tests

- Purs (`.test.mjs`) : `assembleExam` (taille, pas de doublon, déterminisme par seed,
  mélange des options cohérent avec la position correcte) ; `gradeExam` (score, seuil 70 %
  aux bornes 69/70).
- Sondes RLS (curl) : `academy_exam_questions` illisible en anon ET authenticated ;
  `academy_certificates` non exposée directement (pas de lecture publique) ; la vue
  `academy_certificates_public` lisible en anon mais **sans** `user_id` et sans les
  révoqués ; `academy_exam_attempts` illisible cross-user.
- Après migration : scan `get_advisors` (security) + curl anon.

## 7. Hors scope

- **Codes d'accès B2B (P4)** : attribution d'accès Academy sans premium.
- Examens chronométrés, proctoring, questions ouvertes.
- Régénération automatique du certificat en cas de re-passage à un meilleur score
  (le certificat atteste « réussi », pas un score précis).
