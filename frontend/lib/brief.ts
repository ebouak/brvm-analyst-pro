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
  volumePrev: number | null; // valeur échangée séance précédente (FCFA)
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

function motVariation(v: number): string {
  if (Math.abs(v) < 0.2) return 'stagne à';
  if (v > 1) return 'progresse nettement de';
  if (v > 0) return 'progresse de';
  if (v < -1) return 'recule nettement de';
  return 'recule de';
}

function fmtVar(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

function breadthTone(hausses: number, baisses: number): string {
  const ratio = hausses + baisses === 0 ? 0.5 : hausses / (hausses + baisses);
  if (ratio >= 0.65) return 'porteur';
  if (ratio <= 0.35) return 'défavorable';
  return 'mitigé';
}

// ─── Paragraph builders ───────────────────────────────────────────────────────

function buildSummary(input: BriefInput): string {
  const { indices, actions, volumePrev } = input;
  const brvm30 = indices.brvm30;

  // Breadth
  let hausses = 0, baisses = 0;
  let volumeTotal = 0;
  for (const a of actions) {
    const v = a.variation_pct ?? 0;
    if (v > 0) hausses++;
    else if (v < 0) baisses++;
    volumeTotal += a.valeur_echangee ?? 0;
  }

  // No data at all
  if (actions.length === 0) {
    return 'Aucune donnée de marché disponible pour cette séance.';
  }

  let parts: string[] = [];

  // Indice BRVM30
  if (brvm30?.valeur != null && brvm30.variation_pct != null) {
    const mot = motVariation(brvm30.variation_pct);
    parts.push(
      `L'indice BRVM 30 ${mot} ${fmtVar(brvm30.variation_pct)} à ${fmtNumber(brvm30.valeur, 2)} points`
    );
  }

  // Volume
  let volumePart = `dans un volume total de ${fmtFcfa(volumeTotal)} FCFA`;
  if (volumePrev != null && volumePrev > 0) {
    const deltaVol = ((volumeTotal - volumePrev) / volumePrev) * 100;
    const sign = deltaVol >= 0 ? '+' : '';
    volumePart += ` (${sign}${deltaVol.toFixed(0)}% vs séance précédente)`;
  }

  if (parts.length > 0) {
    parts[0] = parts[0] + ', ' + volumePart + '.';
  } else {
    parts.push(`Volume total de la séance : ${fmtFcfa(volumeTotal)} FCFA.`);
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
    let sentence = `Le secteur ${best.secteur} tire la cotation avec une performance de ${fmtVar(best.varPct)}`;
    if (best.leader && best.leaderVar != null) {
      sentence += `, mené par ${best.leader} (${fmtVar(best.leaderVar)})`;
    }
    sentence += '.';
    parts.push(sentence);
  }

  if (worstSectors.length > 0) {
    const worst = worstSectors[worstSectors.length - 1]!;
    let sentence = `À l'inverse, le secteur ${worst.secteur} recule de ${fmtVar(worst.varPct)}`;
    if (worst.leader && worst.leaderVar != null) {
      sentence += ` sous l'effet de ${worst.leader} (${fmtVar(worst.leaderVar)})`;
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
        `À surveiller : ${a.code} combine un signal BUY avec une hausse de ${fmtVar(a.variation_pct ?? 0)} ce jour.`
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
