import { niveauGlobal, type Niveau, type Signal } from '@/lib/controle/types';
import { resumer, type ControleValeur } from '@/lib/boc/ecarts';
import type { TableauCoherence } from '@/lib/admin/coherence';

export function echapperHtmlPur(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const BADGE_NIVEAU: Record<Niveau, string> = {
  alerte: '🔴',
  inconnu: '🟣',
  attention: '🟠',
  ok: '🟢',
  na: '⚪',
};

const LABEL_GLOBAL: Record<Niveau, string> = {
  alerte: 'ALERTE — Action requise',
  inconnu: 'INCONNU — Source illisible',
  attention: 'À SURVEILLER',
  ok: 'TOUT EST À JOUR',
  na: 'NON APPLICABLE',
};

export function formaterTourHtml(signaux: Signal[], observeA: string): string {
  const g = niveauGlobal(signaux);
  const compte = (n: Niveau) => signaux.filter((s) => s.niveau === n).length;
  const graves = signaux.filter((s) => s.niveau === 'alerte' || s.niveau === 'inconnu');
  const surveiller = signaux.filter((s) => s.niveau === 'attention');

  const lignes: string[] = [
    `${BADGE_NIVEAU[g]} <b>Tour de contrôle WESTBOURSE</b>`,
    `Verdict : <b>${LABEL_GLOBAL[g]}</b> (${observeA.slice(11, 16)} UTC)`,
    `Bilan : ${compte('alerte')} alerte(s) · ${compte('inconnu')} inconnu(s) · ${compte('attention')} à surveiller · ${compte('ok')} OK`,
  ];

  if (graves.length > 0) {
    lignes.push('', '<b>À traiter en priorité :</b>');
    for (const s of graves.slice(0, 8)) {
      lignes.push(`${BADGE_NIVEAU[s.niveau]} <b>${echapperHtmlPur(s.titre)}</b> — ${echapperHtmlPur(s.detail)}`);
    }
    if (graves.length > 8) {
      lignes.push(`… et ${graves.length - 8} autre(s) point(s) grave(s).`);
    }
  }

  if (surveiller.length > 0) {
    lignes.push('', '<b>À surveiller :</b>');
    for (const s of surveiller.slice(0, 5)) {
      lignes.push(`🟠 <b>${echapperHtmlPur(s.titre)}</b> — ${echapperHtmlPur(s.detail)}`);
    }
    if (surveiller.length > 5) {
      lignes.push(`… et ${surveiller.length - 5} autre(s).`);
    }
  }

  if (graves.length === 0 && surveiller.length === 0) {
    lignes.push('', '✅ Aucun blocage détecté sur les envois, tâches ou données.');
  }

  return lignes.join('\n');
}

export function formaterBocHtml(controles: ControleValeur[]): string {
  if (controles.length === 0) {
    return 'ℹ️ <b>Contrôle BOC</b>\nAucune cote officielle disponible en base. Relancez <code>controle-boc</code>.';
  }

  const r = resumer(controles);
  const perEcarts = controles.filter((c) => c.per.etat === 'ecart');
  const rdtEcarts = controles.filter((c) => c.rendement.etat === 'ecart');

  const fmt = (x: number | null, suffix: string) =>
    x == null ? '—' : `${x.toFixed(2).replace('.', ',')}${suffix}`;

  const lignes: string[] = [
    `📊 <b>Contrôle Bulletin Officiel (BOC)</b> · ${echapperHtmlPur(r.dateSeance ?? '—')}`,
    `Valeurs : ${r.valeurs} · Écarts PER : <b>${r.ecartsPer.length}</b> · Écarts Rdt : <b>${r.ecartsRendement.length}</b>`,
  ];

  if (perEcarts.length > 0) {
    lignes.push('', '<b>Écarts PER (&gt; 3 %) :</b>');
    for (const c of perEcarts.slice(0, 10)) {
      const pct = c.per.ecart != null ? ` (${c.per.ecart > 0 ? '+' : ''}${(c.per.ecart * 100).toFixed(1)} %)` : '';
      lignes.push(
        `• <b>${echapperHtmlPur(c.code)}</b> : site ${fmt(c.per.site, '×')} vs BOC ${fmt(c.per.boc, '×')}${pct}`,
      );
    }
  }

  if (rdtEcarts.length > 0) {
    lignes.push('', '<b>Écarts Rendement (&gt; 3 %) :</b>');
    for (const c of rdtEcarts.slice(0, 10)) {
      lignes.push(
        `• <b>${echapperHtmlPur(c.code)}</b> : site ${fmt(c.rendement.site, ' %')} vs BOC ${fmt(c.rendement.boc, ' %')}`,
      );
    }
  }

  if (r.perManquants.length > 0) {
    lignes.push('', `⚠️ PER BOC absent du site : ${echapperHtmlPur(r.perManquants.slice(0, 12).join(', '))}`);
  }
  if (r.suspendues.length > 0) {
    lignes.push(`⏸️ Suspendues : ${echapperHtmlPur(r.suspendues.join(', '))}`);
  }
  if (perEcarts.length === 0 && rdtEcarts.length === 0 && r.perManquants.length === 0) {
    lignes.push('', '✅ Tous les ratios comparables concordent avec le BOC.');
  }

  return lignes.join('\n');
}

export function formaterCoherenceHtml(tableau: TableauCoherence): string {
  if (tableau.etat === 'table_absente') {
    return '⏳ <b>Cohérence des fiches</b>\nTable absente (migration 0141 non appliquée).';
  }
  if (tableau.etat === 'erreur') {
    return `🔴 <b>Cohérence des fiches</b>\nLecture impossible : ${echapperHtmlPur(tableau.erreurMessage ?? 'erreur')}`;
  }
  if (tableau.etat === 'jamais_balaye') {
    return '🟣 <b>Cohérence des fiches</b>\nAucune preuve de passage. Relancez le workflow <code>coherence</code>.';
  }

  const trompeuses = tableau.anomalies.filter((a) => a.gravite === 'trompeuse');
  const lignes: string[] = [
    '🔎 <b>Cohérence des fiches société</b>',
    `Trompeuses ouvertes : <b>${tableau.kpis.trompeuses}</b> · À surveiller : <b>${tableau.kpis.aSurveiller}</b> · Valeurs : ${tableau.kpis.valeursConcernees}`,
  ];

  if (tableau.dernierPassage) {
    lignes.push(
      `Dernier passage : ${tableau.dernierPassage.quand.slice(0, 16).replace('T', ' ')} UTC (${echapperHtmlPur(tableau.dernierPassage.status)})`,
    );
  }

  if (trompeuses.length > 0) {
    lignes.push('', '<b>Top anomalies trompeuses :</b>');
    for (const a of trompeuses.slice(0, 8)) {
      lignes.push(`🔴 <b>${echapperHtmlPur(a.code)}</b> (${echapperHtmlPur(a.regle)}) — ${echapperHtmlPur(a.message)}`);
    }
  } else if (tableau.anomalies.length === 0) {
    lignes.push('', '✅ Aucune anomalie ouverte.');
  }

  return lignes.join('\n');
}
