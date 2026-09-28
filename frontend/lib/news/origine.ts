/**
 * Libellé de SOURCE d'un article de `brvm_news`, partagé par /actualites
 * (NewsList) et /veille (VeilleDashboard).
 *
 * Module NEUTRE (pas de 'use client') : il peut être importé des deux côtés.
 * Exporter une fonction depuis un module client pour un composant serveur a
 * déjà cassé la landing (HTTP 500, voir lib/landing/formats.ts).
 *
 * Deux règles, chacune née d'un défaut constaté :
 *
 * 1. `source` n'est pas une origine : les scrapers y écrivent 'brvm' pour tout
 *    article du marché. On affiche `source_label` (« Sika Finance »…), et on
 *    ne retombe sur `source` qu'en dernier recours.
 *
 * 2. Un article trouvé par Perplexity (`source_type = 'perplexity'`) n'a pas
 *    pour éditeur Perplexity : c'est un moteur de recherche. On affiche le
 *    DOMAINE de l'article cité, suivi de « via recherche IA », parce que le
 *    titre et le résumé sont rédigés par le modèle, pas par l'éditeur
 *    (décision du 2026-09-28).
 */

export interface SourceArticle {
  source?: string | null;
  source_label?: string | null;
  source_type?: string | null;
  source_url?: string | null;
}

/** Libellés qui ne désignent pas un éditeur. */
const NON_EDITEURS = new Set(['brvm', 'Inconnu', 'Perplexity (recherche web)']);

const LIBELLES_SOURCE: Record<string, string> = { brvm: 'BRVM', cosumaf: 'COSUMAF', autre: 'Autre' };

/** Domaine lisible d'une URL (sans « www. »), ou null. */
export function domaine(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

export function libelleSource(a: SourceArticle): string {
  if (a.source_type === 'perplexity') {
    const d = domaine(a.source_url);
    return d ? `${d} · via recherche IA` : 'Recherche IA';
  }
  const label = a.source_label?.trim();
  if (label && !NON_EDITEURS.has(label)) return label;
  const s = a.source ?? '';
  return LIBELLES_SOURCE[s] ?? (s || 'Source');
}
