# Academy v2 — Plateforme d'apprentissage type Coursera

**Date** : 2026-07-18 · **Statut** : validé (brainstorming avec l'utilisateur)
**Objet** : transformer `/formations/academy` (manuel IA en iframe) en vraie
plateforme d'apprentissage : interface type Coursera avec outils, progression,
examens, certificats, cas réels BRVM, accès Premium ou code.

## 1. Contexte

L'Academy actuelle : 44 leçons générées par IA (table `academy_courses`,
`content` JSONB validé zod : sections definition/importance/cas/piege/lexique/
retenir + QCM + graphique + image), rendues en HTML statique servi dans une
**iframe**. Aucune progression, quiz décoratifs, design isolé du produit.

Décisions produit (arbitrées avec l'utilisateur) :
- **Objectif n°1** : expérience d'apprentissage + contenu ancré dans des cas réels.
- **Cas réels — les 3 formes** : exercices sur données live du site, études de
  cas historiques rédigées, liens contextuels vers l'app.
- **Expérience — les 4 briques** : progression + reprise, scores de quiz avec
  validation, parcours guidé par niveau, certificat de réussite.
- **Accès** : Premium **ou** code d'accès généré/attribué par l'admin (vouchers
  pour formations payantes, partenaires, B2B).
- **UI** : interface type **Coursera**, avec les outils (notes, glossaire,
  ressources, discussion).

## 2. Architecture & routes

L'iframe disparaît. Le `content` JSONB existant est rendu **nativement en
React** (les 44 leçons migrent sans réécriture). `html` et `/api/academy/[slug]`
restent en legacy (rollback), suppression ultérieure.

| Route | Rôle |
|---|---|
| `/formations/academy` | Hub du parcours : 4 niveaux, % par niveau, « Reprendre » |
| `/formations/academy/[slug]` | **Shell d'apprentissage** (cours + leçon active) |
| `/formations/academy/[slug]?lecon=N` | Leçon N du cours (état d'URL partageable) |
| `/formations/academy/examen/[niveau]` | Examen de fin de niveau |
| `/formations/academy/certificat/[niveau]` | Certificat nominatif (print + partage) |
| `/formations/academy/code` | Activation d'un code d'accès |

## 3. UI — le shell type Coursera

Trois zones, design system WESTBOURSE (DeFi cyan) :

- **Gauche — sommaire du cours** (sticky, repliable en mobile) : liste des
  leçons avec coche ✓ (terminée), icône type (leçon / cas pratique / examen),
  durée estimée, verrou sur les niveaux non débloqués. Barre de progression du
  cours en tête.
- **Centre — contenu de la leçon** : sections rendues en blocs chartés
  (définition, importance, cas BRVM, pièges, à retenir), graphique Recharts,
  image, **QCM interactif** en fin de leçon, bloc « Mettre en pratique »
  (exercice live + liens vers l'app). En bas : bouton **« Marquer terminée /
  Leçon suivante → »** (pattern CoursePlayer des modules vidéo).
- **Droite — panneau OUTILS** (onglets, repliable ; en mobile : tiroir) :
  - **Notes** : notes personnelles par leçon (autosauvegardées, table
    `academy_notes`, RLS owner) — exportables en fin de cours.
  - **Glossaire** : le glossaire du cours, filtrable.
  - **Ressources** : liens curés « Pratiquer sur WESTBOURSE » + sources.
  - **Discussion** : lien vers un fil dédié du forum existant (`/forum`),
    pré-rempli au titre du cours (pas de nouveau système de commentaires).

Célébration à la complétion (leçon → toast ; niveau → écran de félicitations
avec CTA examen). Navigation clavier ←/→ entre leçons.

## 4. Modèle de données (migration 0109)

Tables nouvelles — RLS stricte (discipline pentest 2026-07-09 : policies
explicites, jamais de lecture anon, sonde clé anon après migration) :

| Table | Colonnes clés | RLS |
|---|---|---|
| `academy_progress` | user_id, course_id, lesson_idx, completed, quiz_score, quiz_passed, updated_at — PK (user, course, lesson) | owner strict (select/insert/update) |
| `academy_exam_attempts` | user_id, niveau, score_pct, passed, answers jsonb, created_at | owner strict |
| `academy_certificates` | user_id, niveau, certificate_no unique (`WB-2026-NNNNNN`), full_name (snapshot), delivered_at | owner select ; insert serveur |
| `academy_notes` | user_id, course_id, lesson_idx, note text, updated_at — PK (user, course, lesson) | owner strict |
| `academy_access_codes` | code unique lisible, label (« à qui »), max_uses, used_count, expires_at, active, created_by | **service_role uniquement** |
| `academy_code_redemptions` | code_id, user_id, redeemed_at — unique (code, user) | owner select ; insert serveur |

Schéma leçon (zod) étendu : `exercice_id?` (référence un exercice live),
`liens?: {label, href}[]` (ressources), `duree_min?`.

## 5. Accès — Premium OU code

Helper serveur central `canAccessAcademy(userId)` dans `lib/academy/access.ts` :
super_admin **ou** `profiles.is_premium` **ou** rédemption d'un code `active`,
non expiré, `used_count ≤ max_uses`. Toutes les routes academy passent par lui.
Jusqu'à la livraison de la phase Codes, le gate actuel (flag `formations`)
reste en place.

**Admin** (onglet « Codes d'accès » dans `/admin/academy`) : génération en lot
(préfixe, quantité, expiration, max_uses, libellé), liste avec usage, activation/
désactivation, export CSV. Actions serveur `requirePermission('content.write')`
+ `recordAudit`. L'utilisateur active son code sur `/formations/academy/code`
(saisie → validation serveur → rédemption enregistrée).

## 6. Examens & certificats

- **Examen de niveau** : 10 questions tirées côté serveur parmi les QCM des
  leçons du niveau (aucun autorat supplémentaire), mélange stable par tentative,
  correction serveur, seuil **70 %**, repassable (tentatives journalisées).
- **Déblocage** : Débutant toujours ouvert ; niveau N+1 ouvert si examen N réussi.
- **Certificat** : à la réussite d'un examen — page nominative (nom du profil,
  n° unique, niveau, date), CSS print → PDF, route OG image pour partage
  LinkedIn. Vérifiable publiquement par n° (page `/verif-certificat/[no]`,
  affiche niveau + date sans données personnelles au-delà du nom).
  ⚠️ Route **publique** : à ajouter aux `PUBLIC_PREFIXES` du mur d'auth
  (`lib/supabase/middleware.ts`) — un recruteur doit pouvoir vérifier sans compte.

## 7. Exercices sur données live

`lib/academy/exercises.ts` : registre d'exercices **typés et purs** — chaque
exercice = { id, titre, énoncé(data), attendu(data), tolérance, loader serveur }.
Les loaders réutilisent l'existant : `computeRatios`, dividendes **vérifiés**,
`assessValueTrap`, cours du jour. Exemples de lancement :
- `per-du-jour` : « Calcule le PER de {code} au cours d'aujourd'hui » (tolérance ±2 %).
- `rendement-net` : « Quel est le rendement net du dividende de {code} ? ».
- `value-trap-pick` : « Parmi ces 3 titres, lequel est un value trap ? » (QCM data-driven).

Réponse vérifiée par action serveur ; la **date des données est affichée**
(honnêteté) ; résultat enregistré dans `academy_progress`.

**Études de cas** : nouvelles leçons (catégorie « cas ») générées via le
pipeline IA existant **à partir des données vérifiées de la base** (Sonatel
2021-2025, Bernabé, BOA Niger, Filtisac…), relues avant publication.

## 8. Phasage (chaque phase livrable seule)

1. **P1 — Socle natif** : migration 0109 (progress + notes), shell Coursera
   (sommaire + contenu + outils Notes/Glossaire/Ressources), rendu natif des
   sections, QCM scoré, progression/reprise, hub par niveau (sans verrouillage).
2. **P2 — Parcours certifiant** : examens de niveau, déblocage séquentiel,
   certificats (+ vérification publique + OG LinkedIn).
3. **P3 — Cas réels** : moteur d'exercices live (3 exercices de lancement),
   études de cas rédigées, liens contextuels, onglet Discussion (fil forum).
4. **P4 — Codes d'accès** : tables codes/rédemptions, admin de génération,
   page d'activation, bascule du gate vers Premium-ou-code. *(Indépendante :
   avançable si le besoin business presse.)*

## 9. Tests

- **Purs (`.test.mjs`, npx tsx --test)** : tirage/correction d'examen (seuil,
  mélange), calcul/tolérance des exercices live, validation de code (expiré,
  quota, inactif), numérotation certificat, parseur de progression.
- **RLS** : après 0109, scan `get_advisors` + sonde curl **clé anon** sur
  chaque table (aucune lecture anonyme attendue).
- **Build** : tsc + next build ; vérification prod des routes (gate → /login
  pour anonyme, contenu pour premium).

## 10. Hors périmètre (assumé)

- Fusion avec les modules vidéo (`video_courses`) — envisageable plus tard.
- Système de commentaires dédié (on réutilise le forum).
- Paiement à l'unité d'un cours (le billing existant couvre Premium ; les
  codes couvrent le B2B/formations payantes hors ligne).
- Application mobile / offline.
