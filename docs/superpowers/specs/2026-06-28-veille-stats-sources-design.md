# Veille — Stats enrichies + Filtre Top Sources

## Goal

Ajouter 2 nouvelles statistiques à la barre de stats et une section "Top sources" cliquable dans le sidebar de `/veille`, alignant WESTBOURSE avec les meilleures features du widget HTML prototype.

## Fichier unique modifié

`frontend/components/veille/VeilleDashboard.tsx`

---

## 1. Deux nouvelles stats (stats bar)

### SANS ACTU
- **Calcul** : `47 - new Set(filtered.flatMap(n => n.ticker_codes ?? [])).size`
- **Couleur** : `#f59e0b` (orange warn)
- **Label** : `SANS ACTU`
- **Position** : après `COUVERTS`, avant `G.NEWS`
- **Réactif** : calculé depuis `filtered` (changements de période/filtre mis à jour automatiquement)

### SITES OFF.
- **Calcul** : `filtered.filter(n => ['site_officiel','institution'].includes(n.source_type ?? '')).length`
- **Couleur** : `#56d7fd` (cyan accent)
- **Label** : `SITES OFF.`
- **Position** : après `G.NEWS`, avant `MATIERES`
- **Réactif** : depuis `filtered`

Ordre final de la stats bar :
`ARTICLES · AUJOURD'HUI · ALERTES · COUVERTS · SANS ACTU · G.NEWS · SITES OFF. · MATIERES`

---

## 2. Sidebar "Top sources" (filtre cliquable)

### État

```typescript
const [sourceFilter, setSourceFilter] = useState<string | null>(null);
```

### Calcul topSources (déjà dans useMemo `filtered`)

```typescript
const topSources = useMemo(() => {
  const map = new Map<string, number>();
  for (const n of filtered) {
    const s = n.source_label ?? n.source ?? 'Inconnu';
    map.set(s, (map.get(s) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
}, [filtered]);
```

### Intégration dans `filtered`

Insérer le filtre source dans la chaîne useMemo `filtered`, après `secteurFilter` :

```typescript
if (sourceFilter) {
  items = items.filter(n => (n.source_label ?? n.source) === sourceFilter);
}
```

### Comportement clic

- Cliquer une source active `sourceFilter` et reset `secteurFilter` → les deux filtres sont mutuellement exclusifs
- Cliquer à nouveau la même source → désactive le filtre (toggle)
- Cliquer un secteur → reset `sourceFilter`

### UI Sidebar

Section "TOP SOURCES" sous "SECTEURS", même style visuel que les items secteurs :
- Point de couleur unique par source (hash de la chaîne → palette 8 couleurs existante)
- Count à droite dans badge
- Item actif : `border-left: accent`, background légère, badge cyan

---

## Contraintes

- Aucun nouveau fichier créé — tout dans `VeilleDashboard.tsx`
- `topSources` dépend de `filtered` (déjà dans useMemo) — pas de nouveau state
- `sourceFilter` reset sur changement de `period` (via `useCallback` ou `useEffect` si nécessaire) — non : le reset explicite au clic secteur suffit
- Pas de modification de `page.tsx` ni de schéma Supabase
