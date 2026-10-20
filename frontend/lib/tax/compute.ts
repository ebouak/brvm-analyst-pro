/** Calculs fiscaux purs. Le barème est injectable (tests) ; défaut = BAREME réel. */
import { BAREME, type PaysUemoa, type TypeRevenu, type TauxFiscal } from './rates';

type Bareme = Partial<Record<string, Partial<Record<TypeRevenu, TauxFiscal>>>>;

export type ResultatNet =
  | { net: number; impot: number; taux: number; source: string; indisponible?: undefined }
  | { indisponible: true; raison: 'taux_non_confirme' | 'pays_inconnu' };

function lookup(pays: string, type: TypeRevenu, bareme: Bareme): TauxFiscal | 'pays_inconnu' {
  const p = bareme[pays as PaysUemoa];
  if (!p || !p[type]) return 'pays_inconnu';
  return p[type]!;
}

function applique(brut: number, pays: string, type: TypeRevenu, bareme: Bareme): ResultatNet {
  const t = lookup(pays, type, bareme);
  if (t === 'pays_inconnu') return { indisponible: true, raison: 'pays_inconnu' };
  if (t.taux == null) return { indisponible: true, raison: 'taux_non_confirme' };
  const impot = Math.round(brut * t.taux);
  return { net: brut - impot, impot, taux: t.taux, source: t.source };
}

export function dividendeNet(brut: number, pays: string, bareme: Bareme = BAREME): ResultatNet {
  return applique(brut, pays, 'dividende_cote', bareme);
}

export function couponNet(
  brut: number,
  pays: string,
  type: 'obligation_etat' | 'obligation_privee',
  bareme: Bareme = BAREME,
): ResultatNet {
  return applique(brut, pays, type, bareme);
}

export type RendementNetResultat =
  | { valeur: number; taux: number; indisponible?: undefined }
  | { indisponible: true };

/** Rendement (en %) après retenue à la source. */
export function rendementNet(
  rendementBrutPct: number,
  pays: string,
  type: TypeRevenu,
  bareme: Bareme = BAREME,
): RendementNetResultat {
  const t = lookup(pays, type, bareme);
  if (t === 'pays_inconnu' || t.taux == null) return { indisponible: true };
  return { valeur: rendementBrutPct * (1 - t.taux), taux: t.taux };
}

export type BaseFiscale = 'brut' | 'net' | 'inconnu' | null | undefined;

export type RendementSelonBase =
  | { valeur: number; deja_net: true; taux?: undefined; indisponible?: undefined }
  | { valeur: number; deja_net: false; taux: number; indisponible?: undefined }
  | { indisponible: true };

/**
 * Rendement net d'IRVM selon la BASE du montant dont il est tiré.
 * `dividends.montant` est NET (calendrier officiel, Bulletin) : lui retirer
 * encore l'IRVM comptait l'impôt deux fois — défaut corrigé le 2026-10-20.
 * Base inconnue → indisponible, jamais une retenue supposée.
 */
export function rendementNetSelonBase(
  rendementPct: number,
  base: BaseFiscale,
  pays: string,
  bareme: Bareme = BAREME,
): RendementSelonBase {
  if (base === 'net') return { valeur: rendementPct, deja_net: true };
  if (base !== 'brut') return { indisponible: true };
  const r = rendementNet(rendementPct, pays, 'dividende_cote', bareme);
  return r.indisponible ? { indisponible: true } : { valeur: r.valeur, deja_net: false, taux: r.taux };
}
