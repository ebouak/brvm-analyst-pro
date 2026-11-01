/**
 * E-mail du rapport d'audience (hebdo / mensuel) — PUR. Tableaux et styles en
 * ligne (les clients e-mail ignorent <style>), aucun script, aucun pixel de suivi.
 * Agrégats seulement : aucune donnée personnelle. Tout texte venu de PostHog
 * (chemins de pages) est échappé.
 */
import { delta, fmtDelta, sousTotalUemoa } from './lignes';
import { MENTION_COOKIES, resumeAudience } from './resume';
import type { Audience } from './types';

const POLICE = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (x: number) => Math.round(x).toLocaleString('fr-FR').replace(/[  ]/g, ' ');
const NA = '<span style="color:#8b949e">indisponible</span>';

export interface EntreeEmail { periode: 'semaine' | 'mois'; libelleFenetre: string; a: Audience; lien: string }

const td = (s: string, droite = false) => `<td style="padding:6px 8px;border-bottom:1px solid #e5e9ee;font-size:14px;${droite ? 'text-align:right;' : ''}">${s}</td>`;
const h = (s: string) => `<h2 style="margin:22px 0 6px;font-size:15px;color:#0e6f86">${esc(s)}</h2>`;
const table = (rows: string[]) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${rows.join('')}</table>`;

export function construireEmailRapport(e: EntreeEmail): { sujet: string; html: string; text: string } {
  const { a } = e;
  const nom = e.periode === 'semaine' ? 'hebdomadaire' : 'mensuel';
  const sujet = `Rapport d'audience ${nom} — ${e.libelleFenetre}`;
  const prec = a.overviewPrecedent.ok ? a.overviewPrecedent.data : null;

  let kpis: string;
  if (a.overview.ok) {
    const o = a.overview.data;
    const lig = (lib: string, v: number, p: number | undefined) =>
      `<tr>${td(lib)}${td(`<strong>${n(v)}</strong>`, true)}${td(p === undefined ? 'n/d' : fmtDelta(delta(v, p)), true)}</tr>`;
    kpis = table([
      `<tr><th style="text-align:left;font-size:12px;color:#5b6672;padding:4px 8px">Indicateur</th><th style="text-align:right;font-size:12px;color:#5b6672">Période</th><th style="text-align:right;font-size:12px;color:#5b6672">vs précédente</th></tr>`,
      lig('Personnes', o.personnes, prec?.personnes), lig('Sessions', o.sessions, prec?.sessions), lig('Pages vues', o.pagesVues, prec?.pagesVues),
    ]);
  } else kpis = `<p>${NA}</p>`;

  let afrique = `<p>${NA}</p>`;
  if (a.continents.ok) {
    const af = a.continents.data.find((c) => c.code === 'AF');
    const u = a.pays.ok ? sousTotalUemoa(a.pays.data) : null;
    afrique = table([
      `<tr>${td('Afrique')}${td(af ? `<strong>${n(af.personnes)}</strong> personnes` : '0 personne', true)}</tr>`,
      `<tr>${td('dont UEMOA (somme par pays)')}${td(u ? `${n(u.personnes)} personnes` : NA, true)}</tr>`,
    ]);
  }

  const pages = a.pages.ok
    ? table(a.pages.data.slice(0, 5).map((p) => `<tr>${td(esc(p.chemin))}${td(`${n(p.vues)} vues`, true)}</tr>`))
    : `<p>${NA}</p>`;
  const funnel = a.entonnoir.ok
    ? table([
        `<tr>${td('Ont consulté la formation')}${td(n(a.entonnoir.data.academy), true)}</tr>`,
        `<tr>${td('Ont ouvert une leçon')}${td(n(a.entonnoir.data.lecon), true)}</tr>`,
        `<tr>${td("Ont atteint l'inscription")}${td(n(a.entonnoir.data.inscription), true)}</tr>`,
      ])
    : `<p>${NA}</p>`;
  const crm = a.formationCrm.ok
    ? `<p style="margin:0;font-size:14px">${n(a.formationCrm.data.comptes)} compte(s) connecté(s) ont consulté la formation, dont ${n(a.formationCrm.data.afrique)} en Afrique (${n(a.formationCrm.data.uemoa)} en UEMOA).</p>`
    : `<p>${NA}</p>`;
  const resume = resumeAudience(a, prec);

  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f6f8;font-family:${POLICE};color:#12161c">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;padding:22px">
<tr><td>
<h1 style="margin:0;font-size:20px">Rapport d'audience ${nom}</h1>
<p style="margin:2px 0 0;color:#5b6672;font-size:13px">${esc(e.libelleFenetre)}</p>
${h('Chiffres clés')}${kpis}
${h('Afrique')}${afrique}
${h('Pages les plus vues')}${pages}
${h('Entonnoir Academy')}${funnel}
<p style="margin:4px 0 0;font-size:12px;color:#5b6672">Personnes distinctes ayant atteint chaque étape ; l'ordre n'est pas vérifié.</p>
${h('Intérêt formation (CRM)')}${crm}
${h('En bref')}<ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.5">${resume.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
<p style="margin:22px 0 0"><a href="${esc(e.lien)}" style="display:inline-block;background:#0e6f86;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px">Ouvrir le rapport complet</a></p>
<p style="margin:18px 0 0;font-size:12px;color:#5b6672">${esc(MENTION_COOKIES)} Agrégats uniquement, aucune donnée personnelle.</p>
</td></tr></table></td></tr></table></body></html>`;

  const text = [sujet, '', ...resume, '', `Rapport complet : ${e.lien}`, '', MENTION_COOKIES].join('\n');
  return { sujet, html, text };
}
