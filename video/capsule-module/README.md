# Capsules vidéo Academy (format Leçon 1)

Canevas SVG animé (`index.html`) capturé par Playwright puis encodé par FFmpeg,
avec voix off ElevenLabs alignée mot à mot, sous-titres synchronisés et
habillage officiel (`../habillage`).

| Storyboard | Leçon | Format |
|---|---|---|
| `capsules/n1-m1.json` | Niveau 1 · Leçon 1 | solo |
| `capsules/n1-m2.json` | Niveau 1 · Leçon 2 | podcast |
| `capsules/n1-m3.json` | Niveau 1 · Leçon 3 | salon |
| `capsules/n1-m4.json` | Niveau 1 · Leçon 4 | salon |
| `capsules/n1-l7.json` | Niveau 1 · Leçon 7 intégrale (12 tableaux) | solo |
| `capsules/ipo-brvm.json` | Cours IPO BRVM | salon studio |

## Chaîne

```powershell
node video/capsule-module/voix-capsule.mjs n1-l7          # voix + alignement (remotion/.env.local)
node video/capsule-module/render.mjs stills n1-l7         # planche de contrôle → video/out/capsule-module/n1-l7/planche.png
node video/capsule-module/render.mjs full n1-l7 --fps 25 --sub 1 --workers 4
node video/capsule-module/publie.mjs n1-l7                # bucket privé academy-videos (≤ 50 Mo)
```

- Plus de 6 étapes : grille serpentine de 4 colonnes calculée automatiquement.
- Types de carte : `kpis`, `points` (3 ou 4 lignes), `compare` (3 ou 4 barres), `compare_duel`, `grid6`.
- La bande-son longue est synthétisée en PCM côté Node (`genererFondWav`), puis mixée aux voix ;
  `bande-son.wav` existante est réutilisée pour relancer seulement la capture vidéo.
- Au-delà de 5 minutes, `habillage/render.mjs assemble` encode en 30 fps / CRF 25 pour rester sous 50 Mo.

Aucune donnée inventée : chaque chiffre d'un storyboard doit provenir de la leçon publiée
ou de la base WestBourse (date et source dans la `note` de la carte).

## Hors dépôt (dépôt public)

Ces fichiers restent sur le poste qui fait le rendu ; `.gitignore` les écarte :

- `auteur.json` : identité de l'auteur, `{ "prenom": "…", "nomComplet": "…", "role": "…" }`.
  Les storyboards n'écrivent jamais son nom : ils portent `{auteur.prenom}`,
  `{auteur.nomComplet}`, `{auteur.role}`, résolus par `auteur.mjs` (et `voix-edge.py`).
- `logos/auteur.jpg` : photo de l'auteur.

`render.mjs` refuse de rendre si une photo référencée manque (sinon la vidéo sortirait
sans visage, sans erreur), et `auteur.mjs` s'arrête si `auteur.json` est absent.

Les portraits des intervenants (`logos/journaliste.jpg`, `logos/presentatrice-studio.png`)
sont, eux, versionnés : droits confirmés par l'exploitant le 2026-11-28.
