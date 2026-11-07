# DESIGN.md — WESTBOURSE

Contrat visuel dérivé du code livré (branche `design/systeme-contraste`, 2026-11-07).
Sources : `frontend/tailwind.config.ts`, `frontend/app/globals.css`,
`frontend/components/ui/premium.tsx`, `frontend/components/layout/SiteHeader.tsx`.
En cas de divergence, le code gagne ; la divergence est notée en §9.

## 1. Direction : « la cote du soir »

- Une cote de bourse relue le soir : exacte, posée, ouest-africaine (BRVM, FCFA, prose française).
- Données réelles uniquement. Aucun chiffre, niveau ou texte analytique inventé ; une donnée absente se dit (`EmptyStatePremium`), elle ne se remplace pas.
- Un seul accent : le cyan. Les tokens `gold`, `cyan`, `info`, `sapphire`, `blue` ne sont que des alias du même cyan (`tailwind.config.ts:48-64`).
- Chrome sobre : surfaces plates, bordures fines, ombres neutres. Le contenu (chiffres) porte la page, pas le cadre.
- Deux thèmes : sombre par défaut (`:root`, noir profond + teal), clair « papier » (`:root[data-theme="light"]`). Même noms de jetons, valeurs révisées.

## 2. Couleurs

Jetons = triplets RGB (`--color-*`), composés par `withAlpha` : `bg-accent/10`, `text-up/80` restent valides dans les deux thèmes (`tailwind.config.ts:16`).
Contrastes : WCAG 2.x, calculés sur les valeurs du code (texte sur `bg` / sur `surface`).

### Surfaces et traits
| Jeton | Sombre | Clair | Rôle |
|---|---|---|---|
| `bg` (alias obsidian) | 3 3 3 | 250 248 244 | fond de page |
| `surface` (onyx) | 10 20 23 | 255 255 255 | cartes, en-tête, panneaux |
| `elevated` (graphite) | 17 43 51 | 255 255 255 | pastilles neutres, survol, squelette |
| `sunken` | 2 3 3 | 243 240 232 | champs, zones en creux |
| `border` | 27 42 48 | 236 230 218 | trait standard |
| `border-strong` | 42 61 68 | 217 208 189 | trait de bouton fantôme, survol |
| `nuit` / `sur-nuit` / `accent-nuit` | 16 43 53 / 245 243 237 / 86 215 253 | identiques | bandeaux sombres (comparateur SGI), invariants entre thèmes |

### Accent et sémantique
| Jeton | Sombre | Clair | Rôle |
|---|---|---|---|
| `accent` | 86 215 253 | 9 117 143 | fonds, liserés, focus, graphiques |
| `accent-ink` | 86 215 253 | 7 104 128 | **tout texte cyan** et fond de bouton plein |
| `accent-dim` | 47 169 207 | 8 112 138 | variante atténuée |
| `gold-2` / `gold-deep` | 143 230 255 / 42 138 168 | 8 112 138 / 8 112 138 | dégradés, survols (alias cyan) |
| `up` | 63 225 139 | 10 120 68 | hausse, rendement. Rien d'autre |
| `down` | 255 107 107 | 179 38 30 | baisse. Rien d'autre |
| `warn` | 240 178 58 | 138 90 16 | « Conserver », avertissements |
| `purple` | 139 111 194 | 109 79 168 | catégorie secondaire (rare) |
| `emerald-soft` | 122 240 179 | 10 120 68 | variante claire du vert |

### Texte
| Jeton | Sombre | Clair | Rôle |
|---|---|---|---|
| `ivory` (= `white`) | 252 252 252 | 32 28 23 | texte principal, titres |
| `muted` | 181 181 181 | 87 78 64 | texte secondaire, sous-titres, étiquettes |
| `faint` | 122 138 144 | 110 101 86 | unités, notes, mentions de source |

### Contrastes mesurés (sur `bg` / sur `surface`)
| Texte | Sombre | Clair |
|---|---|---|
| ivory | 20,10 / 18,19 | 15,97 / 16,94 |
| muted | 10,06 / 9,10 | 7,71 / 8,17 |
| faint | 5,76 / 5,21 | 5,41 / 5,74 |
| accent | 12,31 / 11,14 | 5,01 / 5,31 |
| accent-ink | = accent | 6,00 / 6,36 |
| up | 12,13 / 10,98 | 5,23 / 5,55 |
| down | 7,43 / 6,72 | 6,16 / 6,54 |
| warn | 10,94 / 9,89 | 5,58 / 5,91 |

Tout passe AA (4,5) dans les deux thèmes. Texte `bg` posé sur fond `accent-ink` (bouton plein) : 12,3 en sombre, 6,0 en clair.

### Règles
- **`text-accent-ink` pour tout texte cyan, jamais `text-accent`.** En clair, l'ancien cyan 12 143 174 mesurait 3,4 à 3,8 : sous AA ; `accent` reste réservé aux aplats, traits et graphiques.
- **Vert et rouge signifient hausse et baisse**, et uniquement cela (`MetricCard` delta, `SignalBadge` achat/vente). Jamais décoratifs, jamais en état « succès/erreur » générique hors de ce sens.
- Ne jamais coder un hex de texte en dur : utiliser un jeton, sinon le thème clair casse. Exception tolérée : `.weekly-content` (§9).
- Le sens ne passe jamais par la seule couleur : flèche ▲/▼ et libellé (`ACHAT`, `VENTE`, `CONSERVER`) l'accompagnent.

## 3. Typographie

| Famille | Variable / classe | Usage |
|---|---|---|
| Bespoke Serif | `--font-display`, `font-display` (repli Georgia) | titres de page et de section, titres d'état vide |
| Supreme | `--font-sans`, `font-sans` (repli Helvetica Neue, system-ui) | tout le texte courant |
| JetBrains Mono | `--font-mono`, `.tabular` | chiffres uniquement (`tabular-nums`, interlettrage -0,01em) |

Le monospace est réservé aux chiffres : pas d'étiquette mono, pas de capitales espacées (retiré le 2026-11-05, `globals.css:186-190`).

### Échelle réelle (`tailwind.config.ts:97-107`)
| Classe | Taille | Interligne | Graisse | Emploi |
|---|---|---|---|---|
| `display-xl` | clamp(3rem, 6.3vw, 6.8rem) | 0,9 | 500 | héros de landing |
| `display-lg` | clamp(2rem, 3.4vw, 3.4rem) | 0,94 | 500 | titres de section de landing |
| `heading-lg` | 24 px | 1,3 | 600 | `h1` d'app (3xl dès md) |
| `heading-md` | 20 px | 1,4 | 600 | sous-titres |
| `heading-sm` | 16 px | 1,5 | 600 | titre de carte |
| `body-md` | 14 px | 1,7 | 400 | corps |
| `body-sm` | 12 px | 1,6 | 400 | secondaire |
| `mono-lg` | 20 px | 1,2 | 600 | grand chiffre |
| `mono-sm` | 11 px | 1,4 | 400 | étiquette de chiffre, muette |
| `overline` | 12 px | 1,4 | 700 | étiquette de section / en-tête de tableau |

- Graisses : 400 (corps), 500 (display, éléments `font-medium`), 600 (titres, chiffres, boutons). Pas de 700+ hors `overline` Tailwind.
- **Plancher : 12 px pour tout contenu lisible ; 11 px (`mono-sm`) seulement pour une étiquette muette** (légende de graphique, unité). Rien de plus petit (aucun `text-[9px]`/`[10px]` dans le kit ni l'en-tête).
- Étiquette de section : `.overline` (`globals.css:192-200`) = 0,75 rem, 600, casse normale, sans interlettrage ; remet à zéro le `text-decoration: overline` de Tailwind.
- Titres : `tracking-tight` ; pas de surtitre (eyebrow) au-dessus d'un titre.

## 4. Espacements, rayons, ombres, mouvement

### Espacement
- Jetons : `section` 24 px, `card` 16 px, `gutter` 32 px ; largeur de contenu `max-w-content` 1480 px (`--content`).
- Réel : cartes `p-4`, états vides `p-12`, coque de panneau `p-1.5`, grilles `gap-4`. En-tête : `h-14`, `max-w-6xl`, `px-4 md:px-6`.
- Cible tactile mobile : lignes de navigation `min-h-[48px]`, bouton menu 40×40 (`SiteHeader.tsx:72,85`).

### Rayons
`chip` 0,6 rem · `card` 1,1 rem · `panel` 1,5 rem · `xl2` 1,8 rem · `full` 9999 px. Boutons : `rounded-xl` (plein/fantôme), `rounded-lg` (état vide). Badges : `rounded-full`. Cœur de `PremiumPanel` : `calc(1.125rem - 0.375rem)`.

### Ombres (pilotées par variable, thème par thème)
| Jeton | Sombre | Clair |
|---|---|---|
| `shadow-card` | 0 10px 24px rgba(0,0,0,.35) | 0 4px 16px rgba(20,20,10,.08) |
| `shadow-panel` | 0 22px 60px rgba(0,0,0,.45) | 0 10px 32px rgba(20,20,10,.10) |
| `shadow-modal` | 0 24px 80px -16px rgba(0,0,0,.85) | 0 16px 48px -12px rgba(20,20,10,.22) |
| `shadow-gold` | liseré 1 px cyan .22, sans halo | liseré cyan .18 + ombre neutre |
| `shadow-gold-sm` | liseré 1 px cyan .45 | liseré cyan .35 |
| `shadow-emerald` | liseré + halo vert | liseré + ombre neutre |

Ombres floues et neutres. Aucune ombre dure décalée. À l'impression, toute ombre est supprimée (`globals.css:362`).

### Mouvement
- Variable `--ease` : 240 ms `cubic-bezier(0.16, 1, 0.3, 1)` (fonds, couleurs, CTA de landing).
- Transition du kit (`EASE`, `premium.tsx:24`) : couleur, fond, bordure, ombre, transform, filtre ; 300 ms `cubic-bezier(0.32,0.72,0,1)`. Survol : `brightness-110`, flèche `translate-x-0.5` ; appui : `scale-[0.98]` (CTA) / `scale-95` (état vide).
- Entrée : `rise-in` 0,7 s (translateY 16 px → 0), `reveal-in`, `nudgeIn`. Clignotement de valeur : `.flash-value` 120 ms, `flash-up-kf` / `flash-down-kf`.
- **Pas de boucle décorative.** Exceptions déclarées : le **bandeau des cours** (`ticker` 46 s linéaire, `wb-ticker-scroll` 40 s en pause au survol) et la **pastille de séance ouverte** (`pulse`, vert).
- `prefers-reduced-motion: reduce` neutralise toutes les animations et transitions (`globals.css:372-378`) ; le ticker embarquable passe en défilement manuel.
- `gold-sweep` est désactivé (`animation: none`).

## 5. Composants du kit (`@/components/ui/premium`)

Tous compatibles serveur, sans hook client.

| Composant | Quand l'employer |
|---|---|
| `SectionHeader` | tête de chaque page : `h1` display + sous-titre `muted` + actions à droite. Seul. Jamais de surtitre ; la prop `accent` est sans effet. |
| `PremiumPanel` | conteneur principal d'un bloc (double coque `border` + cœur `surface`). `glow` réservé au bloc mis en avant d'une page, une fois. |
| `MetricCard` | un KPI : libellé 12 px `muted`, valeur `.tabular` 2xl 600, unité `faint`, delta ▲/▼ coloré `up`/`down`/`muted`. |
| `SignalBadge` | signal moteur uniquement : ACHAT (up), VENTE (down), CONSERVER (warn). Valeur inconnue : pastille neutre avec le libellé brut. |
| `StatPill` | micro-information (statut, étiquette) ; tons `gold`/`sapphire` = cyan en `accent-ink`, `emerald` = hausse, `neutral`. |
| `EmptyStatePremium` | toute absence de donnée : titre display, indication, icône lucide (`ICONE_ETAT`, défaut `Inbox`), action facultative. Chaque page doit gérer l'état vide. |
| `PremiumCTA` | action principale (`gold` : fond `accent-ink`, texte `obsidian`) ; `ghost` pour l'action secondaire. Un seul plein par écran. |
| `Eyebrow` | existe encore, **ne plus l'employer** (voir §9). |

En-tête de site (`SiteHeader`) : `sticky top-0 z-40`, `bg-surface/90` + `backdrop-blur`, trait `border/60`, masqué à l'impression ; navigation mobile en tiroir (`aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`).

## 6. Signature : la source et l'heure du relevé

Toute donnée de marché affichée dit d'où elle vient et quand elle a été relevée : source nommée (BRVM, Bulletin officiel de la cote, calendrier BRVM…), date de séance en toutes lettres, heure du relevé pour l'intraday. En `text-xs` `faint` (5,2 à 5,8 : lisible), sous la donnée, jamais en infobulle seule. Une donnée périmée est signalée comme telle (« séance précédente »), jamais présentée comme actuelle. Pas de mention, pas de chiffre.

## 7. Interdits

Issus des corrections du dépôt (CLAUDE.md §8, nettoyages du 2026-11-05) ; `docs/equipe/LECONS.md` n'existe pas dans le dépôt (§9).
- Surtitre/kicker au-dessus d'un titre, capitales espacées, étiquette mono hors chiffres.
- Emoji et glyphes en guise d'icône : `lucide-react` (stroke 1,75).
- Barre latérale colorée de plus d'1 px ; halo flou derrière un titre ; ombre dure décalée.
- Texte cyan en `text-accent` ; hex de texte en dur ; vert/rouge hors hausse/baisse.
- Corps de texte sous 12 px ; boucle d'animation décorative hors §4.
- Chiffre ou verdict inventé ; état de chargement qui masque un 404 (`loading.tsx` au-dessus d'une route pouvant appeler `notFound()`).
- Classe Tailwind construite dans `lib/` sans ajouter le fichier à `content`.

## 8. Grille de notation (seuil 8 / 10 par rubrique)

Une surface livrée est notée sur 10 pour chaque rubrique ; une note < 8 sur une seule rubrique = à reprendre. Notes entières ; justifier par un constat vérifiable (valeur, fichier, capture).

| Rubrique | 10 | 8 (seuil) | < 8 |
|---|---|---|---|
| **Fidélité aux données** | chaque chiffre vient de la base, source + heure affichées, absences déclarées | une mention de source manque, aucun chiffre faux | chiffre inventé, périmé non signalé, ou arrondi trompeur |
| **Hiérarchie** | un seul élément dominant, ordre de lecture évident en 3 s | deux niveaux clairs, un bloc concurrent | tout au même poids, ou CTA multiples |
| **Cohérence système** | uniquement jetons et kit §5, aucun hex ni valeur orpheline | une valeur arbitraire isolée | composant reconstruit à côté du kit, hex de texte |
| **Typographie** | display/sans/mono respectés, échelle §3, plancher 12/11 px | un écart d'échelle sans gêne | mono hors chiffres, texte < 11 px, graisse hors 400-600 |
| **Couleur et contraste** | AA partout dans les deux thèmes, `accent-ink` pour le texte, vert/rouge sémantiques | une paire à AA limite (4,5-5) | texte < 4,5, cyan en texte clair, couleur seule porteuse de sens |
| **Finitions et mobile** | états vide/chargement/erreur, focus visible, cibles ≥ 44 px, `reduced-motion`, 360 px sans défilement horizontal | un état secondaire manquant | débordement mobile, focus invisible, animation décorative |

## 9. Écarts entre code et intention (à traiter, non réparés ici)

1. `docs/equipe/LECONS.md` et `docs/equipe/PLAYBOOK.md` n'existent pas dans le dépôt : §7 et §8 reposent sur le brief et CLAUDE.md, non sur ces fichiers.
2. `premium.tsx:27-30` : `Eyebrow` subsiste alors que le surtitre est banni (CLAUDE.md, 2026-11-05).
3. `premium.tsx:102` (flèches ▲/▼) et `:182,216` (`→`) : glyphes en guise d'icônes, alors que le dépôt a remplacé glyphes par `lucide-react`. Le sens y est doublé du texte, mais le contrat §7 les interdit.
4. `tailwind.config.ts:107` : `overline` Tailwind = 12 px / 700 / interlettrage 0,04em, alors que `globals.css:192-200` impose 0,75 rem / 600 / 0 : deux définitions pour la même étiquette.
5. `globals.css:116-117` : ombres du thème clair en `rgba(12,143,174,…)`, l'ancien cyan abandonné pour 9 117 143 (cosmétique, trait seulement).
6. `globals.css:421-482` : `.weekly-content` en hex en dur (`#e2e8f0`, `#f8fafc`, `#475569`…), hors thème clair ; `#475569` sur fond sombre ≈ contraste insuffisant.
7. `globals.css:308` (`cta-sheen`) : reflet périodique sur `.landing-hero-cta`, boucle décorative absente de la liste d'exceptions (§4) ; idem animations `cmp-*` (`globals.css:717-739`, `cmp-defile` en boucle infinie).
8. `tailwind.config.ts:149-150` : ticker à 46 s contre 40 s pour `wb-ticker-scroll` (`globals.css:576`).
9. `premium.tsx:128` : `SignalBadge` en `text-xs` (12 px) à `font-semibold`, conforme ; mais `StatPill neutral` (`text-muted` sur `elevated`) non mesuré en clair (`elevated` = blanc : 7,7 d'après `muted`, OK).
