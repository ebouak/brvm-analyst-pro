# Analyse du signal achat/vente/conservation — Design

**Date :** 2026-06-13
**Objectif :** remplacer le « SELL/BUY » sec par une analyse nuancée, consciente
de la position de l'utilisateur (PRU), réconciliant les indicateurs techniques
entre eux, et intégrant en parallèle la logique dividende (acheter avant un
détachement fort ; baisse mécanique du cours après).

## Problèmes adressés

1. Le signal market-wide est présenté comme un conseil personnel sans le cours
   d'achat de l'utilisateur.
2. L'explication est une liste plate de facteurs parfois contradictoires
   (« Signal vendeur » + « tendance haussière MA20>MA50 »).
3. Une baisse récente peut être le détachement mécanique d'un dividende, pas un
   vrai signal vendeur — jamais signalé aujourd'hui.

## Décisions (brainstorming)

- Portée : **frontend (narration) + backend (explication)**.
- **Position-aware** : lecture selon PRU/plus-value latente.
- Dividendes : **volet séparé en parallèle + synthèse réconciliée**.
- Ex-date : **compte à rebours si connue, sinon repli rendement** (jamais inventer).

## Architecture

Quatre fonctions **pures** (testées vitest) appelées au rendu de la fiche action
(per-user, temps-frais), plus une retouche backend déterministe.

```
frontend/lib/signal/
  technical.ts      readTechnical(signal) → TechnicalReading
  dividendTiming.ts analyzeDividendTiming(divs, cours, today) → DividendTiming
  position.ts       readPosition(pos, cours, signal) → PositionContext
  synthesis.ts      synthesize({signal, technical, dividend, position}) → Synthesis
  *.test.ts
frontend/components/SignalAnalysis.tsx   (présentation, server component)
scraper/src/scoring/score.ts             (buildExplanation : clause de tension)
```

### Interfaces

```ts
// technical.ts
interface TechnicalReading {
  headline: string;
  tone: 'bullish' | 'bearish' | 'mixed' | 'neutral';
  points: string[];            // une lecture par indicateur présent
  tension: string | null;      // note explicite quand les indicateurs divergent
}

// dividendTiming.ts
interface DividendTiming {
  status: 'upcoming' | 'recent' | 'historical' | 'none';
  exDate: string | null;
  daysToEx: number | null;          // >0 avant, <0 après
  montant: number | null;
  yieldPct: number | null;          // montant / cours * 100
  mechanicalDropPct: number | null; // ≈ yieldPct
  verdict: string;
}

// position.ts
interface PositionContext {
  held: boolean;
  pru: number | null;
  quantity: number | null;
  latentPnlPct: number | null;
  reading: string;
}

// synthesis.ts
interface Synthesis {
  verdict: string;        // nuancé, jamais un BUY/SELL sec
  rationale: string[];    // raisons ordonnées
  cautions: string[];     // ex. baisse récente partiellement mécanique
}
```

### Règles métier

**technical** : lit `signal.inputs` (rsi, ma20, ma50, volume_ratio, variation_pct)
et les sous-scores. Détecte la tension RSI vendeur ⨯ tendance haussière (et
symétrique) → `tension` explicite, `tone='mixed'`.

**dividendTiming** :
- `upcoming` : ex_date future la plus proche → compte à rebours + rendement +
  baisse mécanique ≈ rendement.
- `recent` : ex_date dans les ~10 derniers jours → « baisse récente en partie
  mécanique, pas un signal vendeur ».
- `historical` : pas d'ex_date exploitable mais montant connu → rendement
  indicatif, sans inventer de date.
- `none`.

**position** (table `portfolios_positions` : `quantite`, `prix_entree`) :
- détenue + SELL + plus-value forte → sécuriser/prendre des bénéfices ;
- détenue + SELL + moins-value → vendre matérialise la perte, arbitrer ;
- détenue + BUY → renforcement possible ; HOLD → conserver ;
- non détenue : BUY = entrée potentielle, SELL = rester à l'écart.

**synthesis** : combine, priorise, produit un verdict nuancé + `cautions`
(notamment le détachement mécanique récent).

## Flux de données

`actions/[code]/page.tsx` charge déjà signal + dividendes + cours. Ajouts :
- élargir la requête dividends à `limit(6)` (récents + à venir) ;
- requête `portfolios_positions` filtrée `user_id + code` (RLS, session) ;
- appel des 4 fonctions au rendu → `<SignalAnalysis>` remplaçant `SignalPanel`.

## Affichage

1. Verdict de synthèse (nuancé + action suggérée) ;
2. Lecture technique (headline + points + encart tension) ;
3. deux colonnes : Position | Dividende ;
4. sous-scores/indicateurs existants repliés en « détails techniques ».

## États limites

- Pas de position → volet « opportunité d'entrée ».
- Pas de dividende → volet masqué.
- Signal `incomplet` → pas de verdict tranché.
- Non connecté → pas de contexte position.

## Backend

`buildExplanation` : clause de tension quand SELL ⨯ tendance haussière (ou BUY ⨯
baisse). Déterministe, améliore aussi `/signaux`. Re-run `score` ensuite.

## Tests (vitest, frontend)

`technical`, `dividendTiming`, `position`, `synthesis` — cas : SELL+gain,
SELL+perte, ex-date imminente, post-détachement récent, pas de dividende,
non détenue, signal incomplet.
