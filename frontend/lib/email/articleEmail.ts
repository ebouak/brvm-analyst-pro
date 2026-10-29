import { LIBELLE_TYPE } from '@/lib/articles/types';

/**
 * Email d'un article publié, envoyé aux abonnés de la newsletter.
 *
 * Le courriel est une VITRINE, pas l'article : titre, image, chapô, et pour un
 * décryptage ses chiffres clés et ses trois cartes de lecture, puis un lien
 * vers la page. Tout vient de l'article tel qu'il a été publié — aucun chiffre
 * n'est recalculé ici, sinon l'email et la page pourraient diverger.
 *
 * Le pied de désabonnement est ajouté par `campaignHtml` (RGPD), pas ici.
 */
export interface ArticlePourEmail {
  slug: string;
  type: string;
  titre: string;
  chapo: string;
  date_fait: string;
  chiffres: Record<string, unknown> | null;
}

interface StatEmail { label: string; valeur: string; sous: string | null }
interface VerdictEmail { titre: string; texte: string }

/** Échappe pour le texte ET les attributs (guillemets compris). */
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const DATE_FR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function dateFr(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : DATE_FR.format(d);
}

/** Les blocs d'un décryptage structuré, ou rien si l'article n'en est pas un. */
function decryptage(a: ArticlePourEmail): { stats: StatEmail[]; verdict: VerdictEmail[]; avertissement: string | null } | null {
  const d = (a.chiffres as { decryptage?: { version?: number; stats?: unknown; verdict?: unknown; avertissement?: unknown } } | null)
    ?.decryptage;
  if (!d || d.version !== 1) return null;
  const stats = Array.isArray(d.stats) ? (d.stats as StatEmail[]).filter((s) => s && typeof s.label === 'string' && typeof s.valeur === 'string') : [];
  const verdict = Array.isArray(d.verdict) ? (d.verdict as VerdictEmail[]).filter((v) => v && typeof v.titre === 'string') : [];
  return { stats, verdict, avertissement: typeof d.avertissement === 'string' ? d.avertissement : null };
}

export function sujetArticle(a: ArticlePourEmail): string {
  const prefixe = LIBELLE_TYPE[a.type] ?? 'Article';
  const sujet = `${prefixe} · ${a.titre}`;
  return sujet.length > 140 ? `${sujet.slice(0, 139)}…` : sujet;
}

export function urlArticle(a: Pick<ArticlePourEmail, 'slug'>, base: string): string {
  return `${base}/actualites/${encodeURIComponent(a.slug)}`;
}

/** Trace d'envoi d'un article (table `article_campagnes`, migration 0169). */
export interface CampagneArticle {
  statut: 'en_cours' | 'envoye' | 'partiel' | 'echec';
  destinataires: number | null;
  envoyes: number | null;
  lance_le: string;
}

/** Seul un échec TOTAL se relance : un envoi partiel a déjà écrit à des abonnés. */
export function peutRelancer(c: CampagneArticle | null): boolean {
  return c == null || c.statut === 'echec';
}

export function libelleCampagne(c: CampagneArticle): string {
  const jour = dateFr(c.lance_le);
  const n = c.envoyes ?? 0;
  const total = c.destinataires ?? 0;
  switch (c.statut) {
    case 'envoye':
      return `Envoyé le ${jour} à ${n} abonné${n > 1 ? 's' : ''}`;
    case 'partiel':
      return `Envoi partiel le ${jour} : ${n} sur ${total}`;
    case 'en_cours':
      return `Envoi lancé le ${jour}, non terminé`;
    case 'echec':
      return `Échec le ${jour}, aucun email parti`;
  }
}

export function articleEmailHtml(a: ArticlePourEmail, base: string): string {
  const url = urlArticle(a, base);
  const image = `${base}/api/articles/${encodeURIComponent(a.slug)}/image`;
  const kicker = `${LIBELLE_TYPE[a.type] ?? 'Article'} · ${dateFr(a.date_fait)}`;
  const dec = decryptage(a);

  const stats = dec?.stats.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-collapse:collapse">` +
      `<tr>${dec.stats
        .slice(0, 4)
        .map(
          (s) =>
            `<td style="padding:10px 8px;border:1px solid #e5e7eb;vertical-align:top;width:25%">` +
            `<div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">${esc(s.label)}</div>` +
            `<div style="font-family:Menlo,Consolas,monospace;font-size:18px;font-weight:700;color:#0b2540;margin-top:4px">${esc(s.valeur)}</div>` +
            (s.sous ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${esc(s.sous)}</div>` : '') +
            `</td>`,
        )
        .join('')}</tr></table>`
    : '';

  const verdict = dec?.verdict.length
    ? dec.verdict
        .slice(0, 3)
        .map(
          (v) =>
            `<div style="border-left:3px solid #0a6f88;padding:6px 12px;margin:10px 0">` +
            `<div style="font-weight:700;color:#0b2540">${esc(v.titre)}</div>` +
            `<div style="font-size:14px;color:#374151">${esc(v.texte)}</div></div>`,
        )
        .join('')
    : '';

  const cta = a.type === 'decryptage' ? 'Lire le décryptage complet' : "Lire l'article";
  const avertissement = dec?.avertissement ?? "Ceci n'est pas un conseil en investissement.";

  return (
    `<p style="font-size:11px;color:#0a6f88;text-transform:uppercase;letter-spacing:.12em;font-weight:600;margin:0">${esc(kicker)}</p>` +
    `<h1 style="font-size:24px;line-height:1.2;color:#0b2540;margin:8px 0 16px">${esc(a.titre)}</h1>` +
    `<a href="${esc(url)}"><img src="${esc(image)}" alt="${esc(a.titre)}" width="560" style="width:100%;max-width:560px;height:auto;border-radius:8px;display:block" /></a>` +
    `<p style="font-size:16px;color:#1f2937;margin:16px 0">${esc(a.chapo)}</p>` +
    stats +
    verdict +
    `<p style="margin:24px 0"><a href="${esc(url)}" style="background:#0b2540;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${esc(cta)}</a></p>` +
    `<p style="font-size:12px;color:#6b7280">${esc(avertissement)}</p>`
  );
}
