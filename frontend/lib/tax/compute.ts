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
