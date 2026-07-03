# Mode clair « Warm Ivory » — design

**Date :** 2026-07-03
**Statut :** approuvé

## 1. Contexte & objectif

WESTBOURSE est aujourd'hui 100 % sombre (thème « DeFi Cyan », tokens Tailwind en
hex fixes dans `tailwind.config.ts`). Objectif : un vrai mode clair, activable
par l'utilisateur, visuellement soigné sur un périmètre volontairement restreint
pour valider le style avant extension.

**Hors scope de cette livraison** (décidé) :
- Les pages admin, premium et les ~100 autres pages du site restent en sombre
  pour l'instant. Extension = 2ᵉ vague, une fois le style validé en usage réel.
- Pas de bascule automatique horaire (lever/coucher du soleil) — seulement
  préférence système + choix manuel persisté.

## 2. Décisions validées (brainstorming)

1. **Activation** : toggle manuel dans le header, qui respecte
   `prefers-color-scheme` au tout premier chargement (avant tout choix
   explicite), puis persiste le choix de l'utilisateur (`localStorage`).
2. **Périmètre v1** : landing (`app/page.tsx`) + dashboard (`app/dashboard/page.tsx`)
   et leurs composants partagés (header `TasteTopbar`, `Footer`, cartes/panels
   utilisés sur ces deux pages).
3. **Palette** : « Warm Ivory » (fond ivoire chaud, cartes blanches) — validée
   par mockup visuel contre 2 autres options (Editorial White, Cool Slate).
4. **Bouton de bascule** : pilule avec icône + libellé (« Clair »/« Sombre »),
   dans le header, à côté du lien Connexion — validé par mockup visuel contre
   2 autres styles (interrupteur, icône seule).

## 3. Architecture : variables CSS, pas de duplication de classes

Les composants utilisent aujourd'hui des classes Tailwind directes
(`bg-bg`, `text-ivory`, `border-border`, `shadow-gold`...) sur ~30 pages.
Réécrire chaque composant en `dark:X light:Y` serait massif et fragile.

**Approche retenue** : convertir les tokens de couleur en variables CSS,
référencées par Tailwind — **aucune classe ne change dans les composants**,
seule la valeur de la variable change selon le thème actif.

- `app/globals.css` : bloc `:root { --color-bg: #030303; ... }` (valeurs
  sombres actuelles, inchangées — c'est le thème par défaut) + bloc
  `:root[data-theme="light"] { --color-bg: #faf8f4; ... }` (nouvelles valeurs).
- `tailwind.config.ts` : chaque couleur passe de `bg: '#030303'` à
  `bg: 'var(--color-bg)'` (et ainsi pour tous les tokens du tableau §4).
  `darkMode: 'class'` déjà présent dans le config est inutilisé ailleurs dans
  le code — pas de conflit, on l'ignore (on ne l'utilise pas, on aurait pu
  le retirer mais ce n'est pas nécessaire pour cette livraison).
- **Anti-flash** : script inline synchrone dans `app/layout.tsx` (`<head>`,
  avant tout rendu), qui lit `localStorage.theme` ou `prefers-color-scheme` et
  pose `data-theme` sur `<html>` immédiatement — évite un flash du mauvais
  thème au chargement (pattern standard, type `next-themes`).
- **Ombres** : `shadow-gold`/`shadow-emerald` (halos cyan/vert lumineux, pensés
  pour fond noir) doivent rester définis via `var(--shadow-gold)` etc., avec une
  valeur différente en clair : ombre neutre discrète
  (`0 4px 16px rgba(0,0,0,0.08)`) plutôt qu'un halo coloré (qui lirait comme un
  bug sur fond clair).

## 4. Table de tokens complète

| Token | Sombre (actuel, inchangé) | Clair (nouveau) |
|---|---|---|
| bg | `#030303` | `#faf8f4` |
| surface | `#0a1417` | `#ffffff` |
| elevated | `#112b33` | `#ffffff` |
| sunken | `#020303` | `#f3f0e8` |
| border | `#1b2a30` | `#ece6da` |
| border-strong | `#2a3d44` | `#d9d0bd` |
| accent / gold / cyan | `#56d7fd` | `#0c8fae` |
| accent-dim | `#2fa9cf` | `#0a7d99` |
| gold-2 / cyan-soft / gold-soft | `#8fe6ff` | `#0a7d99` |
| gold-deep | `#2a8aa8` | `#0a7d99` |
| up / emerald | `#3fe18b` | `#0d8a4f` |
| emerald-soft | `#7af0b3` | `#0d8a4f` |
| info / sapphire / blue | `#56d7fd` | `#0c8fae` |
| down / ruby | `#ff6b6b` | `#b3261e` |
| warn | `#f0b23a` | `#8a5a10` |
| purple | `#8b6fc2` | `#6d4fa8` (assombri, même logique) |
| white / ivory (texte) | `#fcfcfc` | `#2b2620` |
| muted | `#b5b5b5` | `#6b6152` |
| faint | `#5c6b70` | `#a89d8a` |

Toutes les valeurs claires ont été choisies pour tenir le contraste **AA
(4.5:1)** sur fond blanc/ivoire — une simple inversion des valeurs sombres ne
suffit pas (ex. `#8fe6ff` illisible sur blanc, remplacé par `#0a7d99`).

`accent-glow` (halo `#56d7fd24`) et les `backgroundImage` (dégradés
`gold-line`, `obsidian-glow`, `emerald-veil`) restent inchangés en sombre ;
en clair, `obsidian-glow`/`emerald-veil` (halos décoratifs de fond) sont
désactivés (opacité quasi nulle) plutôt que recolorés — un halo lumineux n'a
pas sa place sur fond clair.

## 5. Composants concernés (périmètre v1)

- `app/layout.tsx` : script anti-flash + attribut `data-theme`.
- `app/globals.css` : variables CSS clair/sombre.
- `tailwind.config.ts` : couleurs → `var(--color-*)`.
- Nouveau : `components/ThemeToggle.tsx` (bouton pilule, lit/écrit
  `localStorage` + `data-theme`, icône soleil/lune selon l'état).
- `components/landing/taste/TasteTopbar.tsx` : intègre `ThemeToggle`.
- `app/page.tsx` (landing) + tous ses composants enfants directs.
- `app/dashboard/page.tsx` + `DashboardTicker`, cartes/panels du dashboard.
- `components/Footer.tsx` (déjà partagé, vérifié visuellement en clair).

Les pages hors périmètre (admin, premium, autres) continuent d'utiliser les
mêmes classes Tailwind ; comme `data-theme` ne sera posé à `"light"` que si
l'utilisateur bascule, et que ces pages ne sont pas dans le périmètre vérifié
visuellement, on accepte que leur rendu en clair soit **non garanti** pour
cette itération (elles resteront visuellement correctes en sombre, le mode
clair n'y sera simplement pas vérifié pixel-perfect avant la 2ᵉ vague).

## 6. Tests / vérification

- Pas de logique métier testable unitairement ici (CSS + un composant toggle
  simple). Vérification par **rendu réel** :
  - Build + `tsc` verts.
  - Capture d'écran (ou vérification manuelle navigateur) de la landing et du
    dashboard en clair ET en sombre, contrôle visuel des contrastes.
  - Vérifier l'absence de flash au chargement (thème posé avant hydratation).
  - Vérifier la persistance (`localStorage`) après rechargement.
  - Vérifier le respect de `prefers-color-scheme` sur un premier chargement
    sans préférence stockée.

## 7. Séquencement d'implémentation

1. Variables CSS (`globals.css`) + branchement Tailwind (`tailwind.config.ts`).
2. Script anti-flash dans `layout.tsx`.
3. Composant `ThemeToggle` + intégration dans `TasteTopbar`.
4. Vérification visuelle landing en clair (ajustements ombres/halos si besoin).
5. Vérification visuelle dashboard en clair (ajustements ciblés).
6. Build + vérifications de la section 6 + commit.
