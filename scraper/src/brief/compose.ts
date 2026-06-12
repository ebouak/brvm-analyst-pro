/**
 * Composition de la note de conjoncture quotidienne — fonctions pures, testables.
 * Produit : (1) un texte FR compact pour Telegram, (2) des données structurées
 * (BriefData) pour la page HTML interactive /brief/[date] et l'image OG.
 */

export interface BriefIndice {
  code: string; // BRVMC | BRVM30 (avec ou sans tiret, normalisé)
  valeur: number | null;
  variation_pct: number | null;
}

export interface BriefAction {
  code: string;
  variation_pct: number | null;
  volume: number | null;
}

export interface BriefNews {
  titre: string;
  source?: string | null;
  source_url?: string | null;
}

export interface BriefMarketSummary {
  valeur_transactions: number | null;
  capitalisation_actions: number | null;
  capitalisation_obligations: number | null;
}

export interface BriefInput {
  dateMarche: string; // YYYY-MM-DD
  indices: BriefIndice[];
  actions: BriefAction[];
  news: BriefNews[];
  marketSummary?: BriefMarketSummary | null;
  siteUrl?: string;
}

/** Données structurées persistées (brief_daily.data) pour le rendu interactif. */
export interface BriefData {
  date_marche: string;
  tendance: 'haussiere' | 'baissiere' | 'mitigee';
  breadth: { hausses: number; baisses: number; stables: number };
  indices: { code: string; valeur: number | null; variation_pct: number | null }[];
  top_hausses: { code: string; variation_pct: number }[];
  top_baisses: { code: string; variation_pct: number }[];
  volume_total: number;
  valeur_transactions: number | null;
  capitalisation_actions: number | null;
  capitalisation_obligations: number | null;
  actualites: { titre: string; source: string | null; source_url: string | null }[];
}

/** Normalise un code indice : 'BRVM-C'/'BRVMC' → 'BRVM-C' (affichage). */
function normIndexCode(code: string): string {
  const c = code.replace(/[\s-]/g, '').toUpperCase();
  if (c === 'BRVMC') return 'BRVM-C';
  if (c === 'BRVM30') return 'BRVM-30';
  return code;
}

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2).replace('.', ',')} %`;
}

function fmtVal(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

function fmtFcfaCourt(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1e12) return (v / 1e12).toFixed(2).replace('.', ',') + ' billions';
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2).replace('.', ',') + ' milliards';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1).replace('.', ',') + ' millions';
  return fmtVal(v);
}

function fmtDateFr(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Construit les données structurées de la note. Retourne null si les données
 * sont trop pauvres (aucune action avec variation) — pas de note vide.
 */
export function buildBriefData(input: BriefInput): BriefData | null {
  const withVar = input.actions.filter(
    (a) => a.variation_pct != null && Number.isFinite(a.variation_pct),
  );
  if (withVar.length === 0) return null;

  const hausses = withVar.filter((a) => a.variation_pct! > 0).length;
  const baisses = withVar.filter((a) => a.variation_pct! < 0).length;
  const stables = withVar.length - hausses - baisses;

  // Tendance dérivée du breadth (jamais inventée) : majorité nette = tendance.
  let tendance: BriefData['tendance'] = 'mitigee';
  if (hausses >= baisses * 1.5 && hausses > stables) tendance = 'haussiere';
  else if (baisses >= hausses * 1.5 && baisses > stables) tendance = 'baissiere';

  const sorted = [...withVar].sort((a, b) => b.variation_pct! - a.variation_pct!);
  const topHausses = sorted
    .filter((a) => a.variation_pct! > 0)
    .slice(0, 3)
    .map((a) => ({ code: a.code, variation_pct: a.variation_pct! }));
  const topBaisses = sorted
    .filter((a) => a.variation_pct! < 0)
    .slice(-3)
    .reverse()
    .map((a) => ({ code: a.code, variation_pct: a.variation_pct! }));

  return {
    date_marche: input.dateMarche,
    tendance,
    breadth: { hausses, baisses, stables },
    indices: input.indices.map((i) => ({
      code: normIndexCode(i.code),
      valeur: i.valeur,
      variation_pct: i.variation_pct,
    })),
    top_hausses: topHausses,
    top_baisses: topBaisses,
    volume_total: input.actions.reduce((s, a) => s + (a.volume ?? 0), 0),
    valeur_transactions: input.marketSummary?.valeur_transactions ?? null,
    capitalisation_actions: input.marketSummary?.capitalisation_actions ?? null,
    capitalisation_obligations: input.marketSummary?.capitalisation_obligations ?? null,
    actualites: input.news.slice(0, 4).map((n) => ({
      titre: n.titre,
      source: n.source ?? null,
      source_url: n.source_url ?? null,
    })),
  };
}

const TENDANCE_LABEL: Record<BriefData['tendance'], string> = {
  haussiere: 'Tendance haussière',
  baissiere: 'Tendance baissière',
  mitigee: 'Séance mitigée',
};

/** Compose le texte Telegram à partir des données structurées. */
export function composeBriefText(data: BriefData, siteUrl?: string): string {
  const lines: string[] = [];
  lines.push(`📊 BRVM — Note de conjoncture du ${fmtDateFr(data.date_marche)}`);
  lines.push('');
  lines.push(
    `${data.tendance === 'haussiere' ? '🟢' : data.tendance === 'baissiere' ? '🔴' : '⚖️'} ${TENDANCE_LABEL[data.tendance]} : ${data.breadth.hausses} hausses · ${data.breadth.baisses} baisses · ${data.breadth.stables} stables`,
  );

  for (const idx of data.indices) {
    if (idx.valeur != null && (idx.code === 'BRVM-C' || idx.code === 'BRVM-30')) {
      lines.push(`${idx.code} : ${fmtVal(idx.valeur)} (${fmtPct(idx.variation_pct)})`);
    }
  }

  if (data.top_hausses.length > 0) {
    lines.push('');
    lines.push(
      `🟢 Hausses : ${data.top_hausses.map((a) => `${a.code} ${fmtPct(a.variation_pct)}`).join(' · ')}`,
    );
  }
  if (data.top_baisses.length > 0) {
    lines.push(
      `🔴 Baisses : ${data.top_baisses.map((a) => `${a.code} ${fmtPct(a.variation_pct)}`).join(' · ')}`,
    );
  }

  if (data.valeur_transactions != null) {
    lines.push(`💰 Transactions : ${fmtFcfaCourt(data.valeur_transactions)} FCFA`);
  }
  if (data.volume_total > 0) {
    lines.push(`Volume : ${data.volume_total.toLocaleString('fr-FR')} titres`);
  }

  const news = data.actualites.slice(0, 2);
  if (news.length > 0) {
    lines.push('');
    for (const n of news) {
      const t = n.titre.length > 90 ? n.titre.slice(0, 87) + '…' : n.titre;
      lines.push(`📰 ${t}`);
    }
  }

  const site = siteUrl ?? 'https://frontend-zeta-ten-22.vercel.app';
  lines.push('');
  lines.push(`Note complète → ${site}/brief/${data.date_marche}?utm_source=telegram&utm_medium=brief`);

  return lines.join('\n');
}

/**
 * API rétro-compatible : compose directement le texte depuis l'input brut.
 * Retourne null si données insuffisantes.
 */
export function composeBrief(input: BriefInput): string | null {
  const data = buildBriefData(input);
  if (!data) return null;
  return composeBriefText(data, input.siteUrl);
}
