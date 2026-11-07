# Équipe design : mode d'emploi

Comment l'équipe d'agents travaille sur l'interface de WESTBOURSE. À lire par chaque
agent au démarrage, avec `DESIGN.md` (le système visuel) et `LECONS.md` (les erreurs
déjà commises). Rédigé le 2026-11-07 après le premier chantier (5 pages, 1 024 défauts
relevés par l'audit).

## Rôles

| Rôle | Ce qu'il fait | Modèle |
|---|---|---|
| Chef de projet (la session principale) | Répartit, relaie, tranche les fichiers partagés, lance le serveur d'aperçu, committe | Opus |
| Agent système | Corrige le kit partagé AVANT les pages (`components/ui/premium.tsx`, `globals.css`, `tailwind.config.ts`) | Opus |
| Auditeur | Balayage impeccable statique + pages rendues, liste chiffrée | Sonnet |
| Refonte de page (`unslop`) | Une page, ses seuls fichiers | Sonnet pour les passes mécaniques, Opus si refonte complète |
| Critique (taste-skill) | Note chaque plan et chaque résultat | Opus |
| Rédacteur (humanizer) | Textes visibles uniquement, sans changer un fait | Sonnet |
| Chef de produit | Checklist produit, tests, accessibilité, verdict par page | Opus |

## Règles communes

- Une page = un agent = une liste fermée de fichiers. Un fichier partagé se PROPOSE au chef
  de projet, il ne se modifie pas.
- Aucun agent ne committe, ne pousse, ne lance `next build` ni `next dev`.
- Données réelles uniquement : aucun chiffre, prix, durée ou promesse écrit en dur. Une
  source, une date de séance, une mention légale ou un état vide ne se retire jamais.
- **Vagues de 3 agents au plus.** Le 2026-11-07, sept agents en parallèle ont épuisé la
  limite d'usage de 5 heures et tout s'est arrêté en même temps.

## Budget de jetons

Mesuré au premier chantier : chaque agent a fini entre 170 000 et 205 000 jetons de
contexte, et une relance pour une correction de cinq lignes relisait tout ce contexte.

- **Modèle par tâche.** `haiku` pour un relevé mécanique (compter, lister, vérifier une
  règle simple) ; `sonnet` pour les passes de refonte, le rédacteur, l'auditeur et les
  corrections ; `opus` seulement pour la direction, la critique et le verdict produit.
  Toujours passer `model` explicitement au lancement d'un agent.
- **Ne pas relancer un gros agent pour une petite correction.** Au-delà de ~100 000 jetons
  de contexte, une correction ciblée part à un agent NEUF en `sonnet`, avec le fichier, la
  ligne et la consigne exacte. Il coûte une fraction du coût de reprise.
- **Consignes courtes.** Un lancement renvoie à ce fichier, à `DESIGN.md` et à `LECONS.md`
  au lieu de recopier les règles. Seuls le périmètre de fichiers et la mission sont écrits.
- **Lire étroit.** Lire les lignes utiles (`offset`/`limit`, `grep -n`), jamais un gros
  fichier entier pour une seule fonction.
- **Captures sobres.** Une image coûte cher à regarder : capturer seulement les pages
  modifiées, regarder d'abord ordinateur sombre et clair, puis une seule vue mobile, et
  recadrer sur la zone changée. Le bilan JSON du script de capture sert de premier tri.
- **Open space économe.** Un agent met son bureau à jour au départ, à chaque blocage et à
  la fin ; un message au fil seulement quand il parle à un autre agent. Les écritures du
  chef de projet passent par un seul `batch`.
- **Vagues de 3**, et pas de critique en boucle : une critique, une correction, un verdict.

## La vue : personne ne dit « fini » sans avoir regardé

1. Le chef de projet lance UN serveur d'aperçu :
   `NEXT_DIST_DIR=.next-prod npx next build` puis `NEXT_DIST_DIR=.next-prod npx next start -p 3124`,
   et prépare la session de test : `node scripts/qa-sessions-locales.mjs`
   (fichier `%TEMP%/westbourse-qa/actif-state.json`). Il la révoque à la fin (`--fermer`).
2. Captures AVANT (avant toute modification) et APRÈS :
   `node scripts/captures-pages.mjs --base http://localhost:3124 --pages /ma-page --out <dossier> --etat <state> --prefixe avant|apres`
3. L'agent ouvre ses captures (sombre et clair, ordinateur et mobile) et les décrit dans son
   rapport. Une capture non regardée ne compte pas.

## Critique notée

Le critique note chaque page de 0 à 10 sur six axes, avec une phrase de justification :

| Axe | Ce qui est jugé |
|---|---|
| Fidélité aux données | Chaque chiffre vient de la base, chaque absence est dite |
| Hiérarchie | Un seul élément fort, le reste se tait |
| Système | Jetons, polices, espacements de `DESIGN.md`, aucune valeur en dur |
| Texte | Clair, factuel, sans tournure de vente |
| Accessibilité | Contraste AA dans les deux thèmes, focus visible, texte utile ≥ 12 px |
| Mobile | Pas de débordement, lecture dans l'ordre |

**Seuil : 8 sur chaque axe.** En dessous, la page retourne à son agent avec la liste des
corrections. Les notes sont postées dans l'open space.

## Checklist du chef de produit

- [ ] Aucun chiffre inventé ; les comptes d'univers sont dérivés (`NB_SOCIETES_COTEES`).
- [ ] Sources, dates de séance et unités présentes ; « ne constitue pas un conseil » conservé.
- [ ] Une panne de lecture n'est jamais affichée comme une absence de donnée.
- [ ] Aucun `loading.tsx` au-dessus d'une route qui appelle `notFound()` (statut 404 vérifié).
- [ ] Parcours d'achat, liens d'abonnement, verrous premium inchangés.
- [ ] RGPD : aucune donnée personnelle nouvelle affichée ou collectée.
- [ ] `npx tsc --noEmit` et `npx vitest run` verts.
- [ ] Tests Playwright existants : `npm run e2e` (et `npm run e2e:connecte` pour les pages connectées).
- [ ] Accessibilité automatique : axe-core injecté dans chaque page capturée, 0 violation sérieuse.
- [ ] Composants partagés modifiés : leurs autres pages capturées aussi.

## Garde-fou contre les régressions

Les captures APRÈS validées sont la référence de la page. La refonte suivante commence par
une capture AVANT et la compare à cette référence : tout écart non voulu est un défaut. Les
chiffres changent chaque séance, la comparaison porte donc sur la mise en page, pas sur les
valeurs.

## Open space

Le suivi en direct est un Artifact privé (bureaux en 3D, fil des échanges, captures
avant/après, décisions de l'exploitant, points d'équipe). Collections : `agents`, `fil`,
`etat`, `points` (écrits par l'équipe) et `decisions` (écrit par l'exploitant avec les
boutons « Valider » / « Refaire »). Le chef de projet lit `decisions` avant toute fusion.
