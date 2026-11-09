export interface LigneIntermediaire {
  code: string;
  periode: string;
  type_periode: string;
  revenu_total: number | null;
  resultat_net: number | null;
}

export interface Intermediaire {
  periode: string;
  /** « T3 2026 » / « S1 2026 ». Aucune date de publication : on n'en a pas. */
  libelle: string;
  /** Une ligne de la même période un an avant existe. */
  comparable: boolean;
  variationCaPct: number | null;
  variationResultatPct: number | null;
  chiffreAffaires: number | null;
  resultatNet: number | null;
}

const RE = /^(\d{4})-([TS])(\d)$/;

function cle(periode: string): { an: number; fin: number } | null {
  const m = RE.exec(periode);
  return m ? { an: Number(m[1]), fin: Number(m[3]) * (m[2] === 'T' ? 3 : 6) } : null;
}

/** Variation en %, sur une base strictement positive seulement : pas de pourcentage sur une perte ou un zéro. */
function variation(n: number | null, n1: number | null): number | null {
  if (n == null || n1 == null || !Number.isFinite(n) || !Number.isFinite(n1) || n1 <= 0) return null;
  return ((n - n1) / n1) * 100;
}

/** Période intermédiaire la plus récente d'une valeur, comparée à la même période un an plus tôt. */
export function derniereIntermediaire(lignes: LigneIntermediaire[]): Intermediaire | null {
  const valides = lignes.filter((x) => cle(x.periode) != null);
  if (valides.length === 0) return null;
  valides.sort((a, b) => {
    const ka = cle(a.periode)!, kb = cle(b.periode)!;
    return kb.an - ka.an || kb.fin - ka.fin;
  });
  const d = valides[0];
  const m = RE.exec(d.periode)!;
  const precedente = `${Number(m[1]) - 1}-${m[2]}${m[3]}`;
  const p = valides.find((x) => x.periode === precedente && x.type_periode === d.type_periode) ?? null;
  return {
    periode: d.periode,
    libelle: `${m[2]}${m[3]} ${m[1]}`,
    comparable: p != null,
    variationCaPct: p ? variation(d.revenu_total, p.revenu_total) : null,
    variationResultatPct: p ? variation(d.resultat_net, p.resultat_net) : null,
    chiffreAffaires: d.revenu_total,
    resultatNet: d.resultat_net,
  };
}
