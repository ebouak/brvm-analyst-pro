/**
 * Composition du brief quotidien de séance — fonction pure, testable.
 * Entrées : données du jour déjà chargées (indices, actions, news).
 * Sortie : texte FR ≤ ~12 lignes, prêt pour Telegram et l'archive /brief.
 */

export interface BriefIndice {
  code: string; // BRVM-C | BRVM-30 | ...
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
}

export interface BriefInput {
  dateMarche: string; // YYYY-MM-DD
  indices: BriefIndice[];
  actions: BriefAction[];
  news: BriefNews[];
  siteUrl?: string;
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
 * Compose le brief. Retourne null si les données sont trop pauvres
 * (aucune action avec variation) — on n'envoie pas de brief vide.
 */
export function composeBrief(input: BriefInput): string | null {
  const withVar = input.actions.filter(
    (a) => a.variation_pct != null && Number.isFinite(a.variation_pct),
  );
  if (withVar.length === 0) return null;

  const lines: string[] = [];
  lines.push(`📊 BRVM — Brief de séance du ${fmtDateFr(input.dateMarche)}`);
  lines.push('');

  // Indices
  for (const code of ['BRVM-C', 'BRVM-30']) {
    const idx = input.indices.find((i) => i.code === code);
    if (idx && idx.valeur != null) {
      lines.push(`${code} : ${fmtVal(idx.valeur)} (${fmtPct(idx.variation_pct)})`);
    }
  }

  // Top hausses / baisses
  const sorted = [...withVar].sort((a, b) => b.variation_pct! - a.variation_pct!);
  const hausses = sorted.filter((a) => a.variation_pct! > 0).slice(0, 3);
  const baisses = sorted.filter((a) => a.variation_pct! < 0).slice(-3).reverse();

  if (hausses.length > 0) {
    lines.push('');
    lines.push(`🟢 Hausses : ${hausses.map((a) => `${a.code} ${fmtPct(a.variation_pct)}`).join(' · ')}`);
  }
  if (baisses.length > 0) {
    lines.push(`🔴 Baisses : ${baisses.map((a) => `${a.code} ${fmtPct(a.variation_pct)}`).join(' · ')}`);
  }

  // Volume total
  const totalVolume = input.actions.reduce((s, a) => s + (a.volume ?? 0), 0);
  if (totalVolume > 0) {
    lines.push(`Volume échangé : ${totalVolume.toLocaleString('fr-FR')} titres`);
  }

  // Actualités (2 max)
  const news = input.news.slice(0, 2);
  if (news.length > 0) {
    lines.push('');
    for (const n of news) {
      const t = n.titre.length > 90 ? n.titre.slice(0, 87) + '…' : n.titre;
      lines.push(`📰 ${t}`);
    }
  }

  // Lien
  const site = input.siteUrl ?? 'https://frontend-zeta-ten-22.vercel.app';
  lines.push('');
  lines.push(`Analyse complète → ${site}/societes?utm_source=telegram&utm_medium=brief`);

  return lines.join('\n');
}
