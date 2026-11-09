import { mkdirSync, writeFileSync } from 'node:fs';
import { chargerHistorique } from './historique.js';
import { couvertureParAn, partFigee, radiees, sautsSuspects } from './audit.js';

/** Étape 0 (spec §3) : écrit docs/conseiller/audit-donnees.md. Lecture seule. */
export async function runAudit(): Promise<string> {
  const { donnees: d, empreinte, retirees } = await chargerHistorique();
  const sauts = sautsSuspects(d.series);
  const derniere = d.calendrier.at(-1)!;
  const figees = [...d.series].map(([c, s]) => ({ c, f: partFigee(s), n: s.dates.length })).sort((a, b) => b.f - a.f);
  const totalRetirees = [...retirees.values()].reduce((a, r) => a + r.length, 0);
  const lignesRetirees = [...retirees].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1));
  const lignesRuptures = [...d.ruptures]
    .flatMap(([code, dates]) => [...dates].map((date) => {
      const s = d.series.get(code)!;
      const i = s.pos.get(date)!;
      return { code, date, ratio: s.cours[i]! / s.cours[i - 1]! };
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.code < b.code ? -1 : 1));
  const avecDate = d.dividendes.filter((x) => x.exDate != null).length;
  const md = [
    `# Audit des données — Conseiller v2`,
    ``,
    `Exécuté le ${new Date().toISOString()} · empreinte des données \`${empreinte}\``,
    `Calendrier : ${d.calendrier[0]} → ${derniere} (${d.calendrier.length} séances), ${d.series.size} valeurs.`,
    ``,
    `## 0. Erreurs de saisie retirées (${totalRetirees} séances, ${retirees.size} valeurs)`,
    ``,
    `Allers-retours hors de [×0,625 ; ×1,6] revenus à ±10 % dans les 5 séances (spec §11.2), retirés avant tout calcul.`,
    ``,
    `| Valeur | Séances retirées |`,
    `|---|---|`,
    ...lignesRetirees.map(([c, r]) => `| ${c} | ${r.length} |`),
    ``,
    `## 0 bis. Ruptures non expliquées (${lignesRuptures.length})`,
    ``,
    `Variation d'une séance hors de [×0,8 ; ×1,25] sans dividende détaché ce jour-là qui l'explique (spec §11.3). Les fenêtres qui les contiennent sont exclues du banc.`,
    ``,
    `| Valeur | Date | Rapport |`,
    `|---|---|---|`,
    ...lignesRuptures.map((r) => `| ${r.code} | ${r.date} | ${r.ratio.toFixed(3)} |`),
    ``,
    `## 1. Sauts de cours hors de [×0,6 ; ×1,6] (${sauts.length})`,
    ``,
    `| Valeur | Date | Rapport |`,
    `|---|---|---|`,
    ...sauts.map((s) => `| ${s.code} | ${s.date} | ${s.ratio.toFixed(3)} |`),
    ``,
    `À recouper un par un avec les opérations sur titres connues. Un fractionnement non ajusté exige une table d'ajustements AVANT le banc.`,
    ``,
    `## 2. Cours figés (part de séances sans échange)`,
    ``,
    `| Valeur | Séances | Part figée |`,
    `|---|---|---|`,
    ...figees.map((p) => `| ${p.c} | ${p.n} | ${(p.f * 100).toFixed(1)} % |`),
    ``,
    `## 3. Valeurs sans cotation depuis 30 jours (radiées ou suspendues)`,
    ``,
    radiees(d.series, derniere, 30).join(', ') || 'aucune',
    ``,
    `Sens du biais : si des sociétés radiées manquent à la base, le banc favorise la famille « risque » et pénalise « Vendre ».`,
    ``,
    `## 4. Couverture fondamentale (valeurs couvertes par exercice)`,
    ``,
    '```json',
    JSON.stringify(couvertureParAn(d.comptes.filter((c) => c.resultatNet != null).map((c) => ({ code: c.code, annee: c.exercice })))),
    '```',
    ``,
    `## 5. Dividendes`,
    ``,
    `${d.dividendes.length} dividendes exploitables, dont ${avecDate} avec une ex-date réelle ou reconstituée (${((100 * avecDate) / Math.max(1, d.dividendes.length)).toFixed(0)} %).`,
    `Les autres excluent les fenêtres mai-août de leur valeur (spec §3.5b).`,
    ``,
  ].join('\n');
  mkdirSync('../docs/conseiller', { recursive: true });
  writeFileSync('../docs/conseiller/audit-donnees.md', md);
  return md;
}
