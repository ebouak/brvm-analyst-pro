import type { ActionDaily, IndiceDaily, SignalDaily } from '@/lib/types';
import { fmtNumber, fmtFcfa, fmtDateFR } from '@/lib/format';

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface SectorPerf {
  secteur: string;
  varPct: number;
  count: number;
  leader?: string;
  leaderVar?: number;
}

export interface BriefInput {
  date: string;
  indices: { brvm30: IndiceDaily | null; brvmc: IndiceDaily | null };
  actions: ActionDaily[];
  signals: SignalDaily[];
  /** Valeur des transactions de la séance (brvm_market_summary), null si inconnue. */
  valeurTransactions: number | null;
  /** Même mesure pour la séance précédente, null si inconnue. */
  valeurTransactionsPrev: number | null;
  topSectorPerfs: SectorPerf[];
}

export interface Brief {
  date: string;
  summary: string;   // paragraphe 1 — marché global
  sectors: string;   // paragraphe 2 — sectoriels
  signals: string;   // paragraphe 3 — signaux
  fullText: string;  // tout assemblé
  tone: 'positive' | 'negative' | 'neutral';
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Variation signée au format français : « +1,95 % », « −0,26 % ». */
function pctSigne(v: number, d = 2): string {
  const abs = fmtNumber(Math.abs(v), d);
  const nul = Number(Math.abs(v).toFixed(d)) === 0;
  const s = nul ? '' : v > 0 ? '+' : '−';
  return `${s}${abs} %`;
}

/** Valeur absolue, pour les phrases dont le verbe porte déjà le sens. */
function pctAbs(v: number, d = 2): string {
  return `${fmtNumber(Math.abs(v), d)} %`;
}

/** « L'indice BRVM 30 recule de 0,26 % à 263,47 points » — jamais « recule de -0.26% ». */
function phraseIndice(sujet: string, v: number, valeur: number): string {
  if (Math.abs(v) < 0.2) return `${sujet} est stable (${pctSigne(v)}) à ${fmtNumber(valeur, 2)} points`;
  const verbe = v > 1 ? 'progresse nettement de' : v > 0 ? 'progresse de' : v < -1 ? 'recule nettement de' : 'recule de';
  return `${sujet} ${verbe} ${pctAbs(v)} à ${fmtNumber(valeur, 2)} points`;
}

function breadthTone(hausses: number, baisses: number): string {
  const ratio = hausses + baisses === 0 ? 0.5 : hausses / (hausses + baisses);
  if (ratio >= 0.65) return 'porteur';
  if (ratio <= 0.35) return 'défavorable';
  return 'mitigé';
}

// ─── Paragraph builders ───────────────────────────────────────────────────────

function buildSummary(input: BriefInput): string {
  const { indices, actions } = input;
  const brvm30 = indices.brvm30;

  // Breadth
  let hausses = 0, baisses = 0;
  for (const a of actions) {
    const v = a.variation_pct ?? 0;
    if (v > 0) hausses++;
    else if (v < 0) baisses++;
  }

  // No data at all
  if (actions.length === 0) {
    return 'Aucune donnée de marché disponible pour cette séance.';
  }

  let parts: string[] = [];

  // Valeur échangée : MÊME source que les repères clés (brvm_market_summary).
  // Pendant la séance, les lignes d'actions n'ont pas encore de valeur
  // échangée (la collecte brvm.org ne la porte pas) : les additionner
  // affichait « 0 FCFA (-100 %) ». Sans résumé de séance, on se tait.
  const { valeurTransactions, valeurTransactionsPrev } = input;
  let volumePart: string | null = null;
  if (valeurTransactions != null && valeurTransactions > 0) {
    volumePart = `dans un volume total de ${fmtFcfa(valeurTransactions)} FCFA`;
    if (valeurTransactionsPrev != null && valeurTransactionsPrev > 0) {
      const delta = ((valeurTransactions - valeurTransactionsPrev) / valeurTransactionsPrev) * 100;
      volumePart += ` (${pctSigne(delta, 1)} sur la séance précédente)`;
    }
  }

  if (brvm30?.valeur != null && brvm30.variation_pct != null) {
    const p = phraseIndice("L'indice BRVM 30", brvm30.variation_pct, brvm30.valeur);
    parts.push(volumePart ? `${p}, ${volumePart}.` : `${p}.`);
  } else if (volumePart) {
    parts.push(`Séance conclue ${volumePart}.`);
  }

  // Breadth
  const tone = breadthTone(hausses, baisses);
  const stables = actions.length - hausses - baisses;
  parts.push(
    `${hausses} action${hausses > 1 ? 's' : ''} en hausse, ${baisses} en baisse` +
    (stables > 0 ? `, ${stables} stables` : '') +
    ` — marché ${tone}.`
  );

  return parts.join(' ');
}

function buildSectors(topSectorPerfs: SectorPerf[]): string {
  if (topSectorPerfs.length === 0) {
    return 'Performance sectorielle non disponible.';
  }

  const bestSectors = topSectorPerfs.filter((s) => s.varPct >= 0.5);
  const worstSectors = topSectorPerfs.filter((s) => s.varPct <= -0.5);

  const noSignificantMove =
    bestSectors.length === 0 && worstSectors.length === 0;

  if (noSignificantMove) {
    return 'Performance sectorielle dispersée, aucun mouvement marquant ce jour.';
  }

  const parts: string[] = [];

  if (bestSectors.length > 0) {
    const best = bestSectors[0]!;
    let sentence = `Le secteur ${best.secteur} tire la cotation avec une performance de ${pctSigne(best.varPct)}`;
    if (best.leader && best.leaderVar != null) {
      sentence += `, mené par ${best.leader} (${pctSigne(best.leaderVar)})`;
    }
    sentence += '.';
    parts.push(sentence);
  }

  if (worstSectors.length > 0) {
    const worst = worstSectors[worstSectors.length - 1]!;
    let sentence = `À l'inverse, le secteur ${worst.secteur} recule de ${pctAbs(worst.varPct)}`;
    if (worst.leader && worst.leaderVar != null) {
      sentence += ` sous l'effet de ${worst.leader} (${pctSigne(worst.leaderVar)})`;
    }
    sentence += '.';
    parts.push(sentence);
  }

  return parts.join(' ');
}

function buildSignals(signals: SignalDaily[], actions: ActionDaily[]): string {
  const buys = signals.filter((s) => s.signal === 'BUY');
  const sells = signals.filter((s) => s.signal === 'SELL');

  if (buys.length === 0 && sells.length === 0) {
    return 'Aucun signal d\'opportunité déclenché aujourd\'hui.';
  }

  const parts: string[] = [];

  // Count BUY / SELL
  const buyLabel =
    buys.length > 0
      ? `${buys.length} signal${buys.length > 1 ? 's' : ''} BUY` +
        (buys.length <= 3 ? ` (${buys.map((s) => s.code).join(', ')})` : '')
      : null;
  const sellLabel =
    sells.length > 0
      ? `${sells.length} signal${sells.length > 1 ? 's' : ''} SELL` +
        (sells.length <= 3 ? ` (${sells.map((s) => s.code).join(', ')})` : '')
      : null;

  const countSentence = [buyLabel, sellLabel].filter(Boolean).join(', ') + '.';
  parts.push(countSentence.charAt(0).toUpperCase() + countSentence.slice(1));

  // Average confidence
  const activeSignals = [...buys, ...sells];
  const withConf = activeSignals.filter((s) => s.confiance != null);
  if (withConf.length > 0) {
    const avgConf =
      withConf.reduce((acc, s) => acc + (s.confiance ?? 0), 0) / withConf.length;
    parts.push(`Confiance moyenne : ${avgConf.toFixed(0)}%.`);
  }

  // Notable action: BUY signal + strong gain
  if (buys.length > 0) {
    const notable = buys
      .map((sig) => ({
        sig,
        action: actions.find((a) => a.code === sig.code),
      }))
      .filter((x) => x.action?.variation_pct != null && (x.action.variation_pct ?? 0) > 2)
      .sort((a, b) => (b.action?.variation_pct ?? 0) - (a.action?.variation_pct ?? 0))[0];

    if (notable) {
      const a = notable.action!;
      parts.push(
        `À surveiller : ${a.code} combine un signal BUY avec une hausse de ${pctAbs(a.variation_pct ?? 0)} ce jour.`
      );
    }
  }

  return parts.join(' ');
}

function deriveTone(
  brvm30: IndiceDaily | null,
  hausses: number,
  baisses: number
): 'positive' | 'negative' | 'neutral' {
  const indexVar = brvm30?.variation_pct ?? 0;
  if (indexVar > 0.5 || hausses > baisses * 1.5) return 'positive';
  if (indexVar < -0.5 || baisses > hausses * 1.5) return 'negative';
  return 'neutral';
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateBrief(input: BriefInput): Brief {
  const { date, indices, actions, signals, topSectorPerfs } = input;

  // Guard: empty market
  if (actions.length === 0) {
    const empty = 'Aucune donnée disponible pour cette séance.';
    return {
      date,
      summary: empty,
      sectors: '',
      signals: '',
      fullText: empty,
      tone: 'neutral',
    };
  }

  const summary = buildSummary(input);
  const sectors = buildSectors(topSectorPerfs);
  const signalsPara = buildSignals(signals, actions);

  let hausses = 0, baisses = 0;
  for (const a of actions) {
    const v = a.variation_pct ?? 0;
    if (v > 0) hausses++;
    else if (v < 0) baisses++;
  }
  const tone = deriveTone(indices.brvm30, hausses, baisses);

  const fullText = [summary, sectors, signalsPara].filter(Boolean).join('\n\n');

  return { date, summary, sectors, signals: signalsPara, fullText, tone };
}

// ─── Sector aggregation helper (used in page.tsx) ────────────────────────────

export function computeTopSectorPerfs(actions: ActionDaily[]): SectorPerf[] {
  const map = new Map<string, { total: number; count: number; leader: string; leaderVar: number }>();

  for (const a of actions) {
    const sec = a.secteur ?? 'Autre';
    const v = a.variation_pct ?? 0;
    const existing = map.get(sec);
    if (!existing) {
      map.set(sec, { total: v, count: 1, leader: a.code, leaderVar: v });
    } else {
      existing.total += v;
      existing.count += 1;
      if (Math.abs(v) > Math.abs(existing.leaderVar)) {
        existing.leader = a.code;
        existing.leaderVar = v;
      }
    }
  }

  return Array.from(map.entries())
    .map(([secteur, d]) => ({
      secteur,
      varPct: d.count > 0 ? d.total / d.count : 0,
      count: d.count,
      leader: d.leader,
      leaderVar: d.leaderVar,
    }))
    .sort((a, b) => b.varPct - a.varPct);
}
