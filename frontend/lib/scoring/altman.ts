/**
 * Altman Z-Score — risque de détresse financière.
 *
 * Modèle Z'' (marchés émergents, non-manufacturier), adapté à la BRVM :
 *   Z'' = 3.25 + 6.56·X1 + 3.26·X2 + 6.72·X3 + 1.05·X4
 *   X1 = fonds de roulement / total actif
 *   X2 = réserves (report à nouveau) / total actif
 *   X3 = résultat d'exploitation (EBIT) / total actif
 *   X4 = capitaux propres / total dettes
 *
 * IMPORTANT : le modèle est INADAPTÉ aux banques (bilan structurellement très
 * endetté). Pour famille = 'banque', on renvoie applicable=false (honnête).
 *
 * Fonction pure et testable.
 */

export interface AltmanInput {
  total_actifs: number | null;
  total_actif_circulant: number | null;
  passif_courant: number | null;
  reserves_benefices_non_repartis: number | null;
  resultat_exploitation: number | null;
  total_capitaux_propres: number | null;
  famille: string | null; // 'banque' | 'general' | ...
}

export type AltmanZone = 'safe' | 'grey' | 'distress';

export interface AltmanResult {
  applicable: boolean;
  z: number | null;
  zone: AltmanZone | null;
  note: string | null;
}

export function computeAltmanZ(inp: AltmanInput): AltmanResult {
  if ((inp.famille ?? '').toLowerCase() === 'banque') {
    return { applicable: false, z: null, zone: null, note: 'Modèle Altman inadapté aux banques (structure de bilan spécifique).' };
  }

  const ta = inp.total_actifs;
  const eq = inp.total_capitaux_propres;
  if (ta == null || ta <= 0 || eq == null) {
    return { applicable: false, z: null, zone: null, note: 'États financiers insuffisants pour le calcul.' };
  }

  const liabilities = ta - eq; // dettes totales = actif - capitaux propres
  const x1 = ((inp.total_actif_circulant ?? 0) - (inp.passif_courant ?? 0)) / ta;
  const x2 = (inp.reserves_benefices_non_repartis ?? 0) / ta;
  const x3 = (inp.resultat_exploitation ?? 0) / ta;
  const x4 = liabilities > 0 ? eq / liabilities : 0;

  const z = 3.25 + 6.56 * x1 + 3.26 * x2 + 6.72 * x3 + 1.05 * x4;
  const zone: AltmanZone = z > 2.6 ? 'safe' : z >= 1.1 ? 'grey' : 'distress';

  return { applicable: true, z: Math.round(z * 100) / 100, zone, note: null };
}
