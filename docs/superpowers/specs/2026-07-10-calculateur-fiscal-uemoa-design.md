# Calculateur fiscal UEMOA — Design

**Date** : 2026-07-10 · **Statut** : validé (user) · **Priorité** : livraison avant WhatsApp

## 1. Objectif

Donner à l'investisseur BRVM le **revenu net d'impôt réel** de ses dividendes et
coupons obligataires selon le pays de l'émetteur (IRVM / IRC des 8 pays UEMOA).
Personne ne le fait sur le marché → différenciateur + fort contenu SEO.

Périmètre V1 (décision user) : **dividendes + obligations**. La vue « portefeuille
net d'impôt » est explicitement hors V1 (extension naturelle en V2).

## 2. Principe d'honnêteté des taux (non négociable)

- Chaque taux du barème porte : `taux`, `source` (texte officiel : CGI national,
  loi de finances, note BRVM/SGI), `sourceUrl`, `verifieLe` (date ISO).
- Les taux sont **vérifiés pendant l'implémentation** (recherche web sur sources
  officielles). Aucun taux de mémoire de modèle.
- Pays/type non vérifiable → l'UI affiche « taux non confirmé — consultez votre
  SGI », jamais un chiffre douteux.
- Disclaimer partout : « Information générale à jour au {date}. Ne constitue pas
  un conseil fiscal. Consultez votre SGI ou un fiscaliste. »

## 3. Architecture (approche retenue : constantes TS versionnées)

Approche B (table Supabase + admin) rejetée : les taux changent ~1×/an (lois de
finances) — YAGNI. Un commit met à jour le barème, l'historique git trace tout.

### 3.1 `frontend/lib/tax/rates.ts` — le barème (données)

```ts
export type PaysUemoa = 'BJ' | 'BF' | 'CI' | 'GW' | 'ML' | 'NE' | 'SN' | 'TG';
export type TypeRevenu = 'dividende_cote' | 'obligation_etat' | 'obligation_privee';

export interface TauxFiscal {
  taux: number | null;        // ex. 0.10 — null = non confirmé
  source: string;             // ex. "CGI Côte d'Ivoire, art. 180 (LF 2025)"
  sourceUrl: string | null;
  verifieLe: string;          // YYYY-MM-DD
  note?: string;              // ex. "exonéré si maturité ≥ 5 ans"
}

export const BAREME: Record<PaysUemoa, Record<TypeRevenu, TauxFiscal>> = { … };
```

### 3.2 `frontend/lib/tax/compute.ts` — fonctions pures

- `dividendeNet(brut, pays)` → `{ net, impot, taux, source } | { indisponible: true }`
- `couponNet(brut, pays, type)` → idem (type état/privée, notes maturité)
- `rendementNet(rendementBrut, pays, type)` → rendement après IRVM/IRC
- Tests : `frontend/lib/tax/compute.test.mjs` (pattern node:test du repo,
  cf. `budgetSimulator.test.mjs`).

### 3.3 Page publique `/fiscalite`

- Plein écran public (ajout à `BARE_PREFIXES` du ConditionalShell, avec footer),
  metadata SEO (title, description, OG), contenu indexable.
- Sections : calculateur interactif (client) → tableau comparatif 8 pays (SSR,
  avec sources) → FAQ (4-6 questions réelles : « qui prélève ? », « double
  imposition ? », « les plus-values sont-elles taxées ? »…) → disclaimer.
- Design system existant (SectionHeader, PremiumPanel, tokens DeFi cyan).

### 3.4 Intégrations app

- `/dividendes` : toggle **Brut / Net** sur la colonne rendement (le pays vient
  de `brvm_instruments.pays`) + onglet ViewTabs vers `/fiscalite`.
- Fiche action (`/actions/[code]`) : ligne « Dividende net (pays) » à côté du brut.
- `/obligations` : colonne « YTM net » (taux obligation d'État vs privée selon
  l'émetteur — TPCI/États = obligation_etat, corporate = obligation_privee).
- Palette ⌘K : entrée « Fiscalité des dividendes (IRVM) » dans PALETTE_EXTRA.
- Footer public : lien « Fiscalité UEMOA ».

## 4. Données personnelles / RGPD

Aucune : calculateur stateless, aucun stockage, aucune saisie identifiante.

## 5. Erreurs & états vides

- Pays absent du référentiel → « taux non confirmé », jamais de calcul silencieux.
- `brvm_instruments.pays` null → pas de toggle net pour ce titre (brut affiché).

## 6. Tests

- `compute.test.mjs` : net/impôt exacts par pays vérifié, propagation des null,
  arrondis (FCFA entiers), rendement net.
- Contrôle manuel : cohérence tableau `/fiscalite` ↔ toggle `/dividendes`.

## 7. Hors périmètre V1 (V2 candidates)

Vue portefeuille net d'impôt · résidence fiscale de l'investisseur (conventions
de non double imposition) · plus-values de cession · export PDF du comparatif.
