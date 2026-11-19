# Coris IPO Article V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir l’article local Coris avec une analyse de microstructure, un simulateur WPLI explicite, les quatre sources de cash, trois scénarios et douze indicateurs de suivi, sans publication.

**Architecture:** La source de données reste typée dans `lib/articles/corisIpo.ts`; des composants serveur rendent les graphiques éditoriaux et un seul composant client porte le simulateur de pression de liquidité. Tous les calculs hypothétiques portent un marquage visuel « simulation », tandis que les données observées restent séparées.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Vitest, SVG accessible et CSS éditorial responsive.

## Global Constraints

- Aucun déploiement, commit ou publication sur `/actualites` comme article de base tant que l’utilisateur ne valide pas.
- Le WPLI est une estimation de pression potentielle, jamais une mesure observée.
- Prix d’introduction, PER, P/B, NPL et CET1 restent « non publiés » tant que les prospectus visés ne les donnent pas.
- Aucun visuel tiers décoratif ne remplace les graphiques construits depuis les données.
- Distinction explicite : données officielles, calculs WESTBOURSE, hypothèses.
- Rester sur la route locale `/analyses/coris-bank-ipo-2027`.

---

### Task 1: Étendre le modèle de données et les indicateurs purs

**Files:**
- Modify: `frontend/lib/articles/corisIpo.ts`
- Modify: `frontend/lib/articles/corisIpo.test.ts`

- [ ] Ajouter les quatre sources de financement, le WPLI par hypothèse, les trois scénarios et les 12 indicateurs.
- [ ] Écrire les tests avant l’implémentation :

```ts
expect(wpli({ souscriptionsMd: 81, partVentes: 0.25, valeur20jMd: 2 })).toEqual({
  cashVenteMd: 20.25,
  seancesEquivalentes: 10.125,
});
expect(wpli({ souscriptionsMd: 81, partVentes: 0, valeur20jMd: 2 }).seancesEquivalentes).toBe(0);
expect(wpli({ souscriptionsMd: 81, partVentes: 0.25, valeur20jMd: 0 }).statut).toBe('indisponible');
```

- [ ] Lancer `cd frontend && npm test -- --run lib/articles/corisIpo.test.ts`.
- [ ] Implémenter `calculerWpli` avec des sorties typées et bornées de 0 à 1 pour `partVentes`.

### Task 2: Ajouter le simulateur WPLI et la provenance du cash

**Files:**
- Create: `frontend/components/articles/coris/WpliSimulator.tsx`
- Modify: `frontend/app/analyses/coris-bank-ipo-2027/page.tsx`
- Modify: `frontend/app/analyses/coris-bank-ipo-2027/coris-ipo.css`

- [ ] Créer un composant client `WpliSimulator` avec trois curseurs : montant immobilisé, part financée par ventes, valeur moyenne 20 séances.
- [ ] Afficher les quatre sources de cash et leur effet secondaire potentiel, sans prétendre connaître leur répartition.
- [ ] Marquer toutes les sorties « Simulation — hypothèse non observée ».
- [ ] Ajouter des états invalides pour moyenne nulle, part hors plage et montant négatif.

### Task 3: Enrichir la partie fondamentale sans inventer de valorisation

**Files:**
- Modify: `frontend/app/analyses/coris-bank-ipo-2027/page.tsx`
- Modify: `frontend/app/analyses/coris-bank-ipo-2027/coris-ipo.css`

- [ ] Ajouter les croissances disponibles : bilan, PNB, résultat net et coefficient d’exploitation publié pour Coris CI.
- [ ] Ajouter une grille PER/P/B/NPL/CET1 avec la valeur « à calculer au prospectus visé » pour chaque ratio.
- [ ] Ajouter les comparables à suivre sans leur attribuer de note ni de prix cible.

### Task 4: Transformer la conclusion en scénarios prospectifs

**Files:**
- Modify: `frontend/lib/articles/corisIpo.ts`
- Modify: `frontend/app/analyses/coris-bank-ipo-2027/page.tsx`
- Modify: `frontend/app/analyses/coris-bank-ipo-2027/coris-ipo.css`

- [ ] Rendre trois cartes : absorption fluide, rotation sectorielle, contraction de liquidité.
- [ ] Remplacer la liste de huit signaux par douze indicateurs avec fréquence et question d’observation.
- [ ] Ajouter une section « impact structurel » avec quatre bénéfices potentiels et une réserve sur la liquidité secondaire.

### Task 5: Vérifier et laisser en validation locale

**Files:**
- Test: `frontend/lib/articles/corisIpo.test.ts`
- Test: browser route `/analyses/coris-bank-ipo-2027`

- [ ] Lancer :

```bash
cd frontend
npm test -- --run lib/articles/corisIpo.test.ts
npm run typecheck
npm run build
```

- [ ] Vérifier HTTP 200, Open Graph 200 et rendu mobile des cartes WPLI/scénarios.
- [ ] Laisser l’article uniquement sur le serveur local ; ne pas déployer, publier, insérer dans `articles`, ni envoyer sur les réseaux.
