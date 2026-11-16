import { etendue, fmtNervosite, type LigneNervosite } from '@/lib/nervosite/affichage';
import { fmtDateFR } from '@/lib/format';

/**
 * Courbe de l'indice de nervosité, SVG pur rendu côté serveur (aucun JS
 * client, lisible à l'impression). Les couleurs passent par les jetons du
 * design system : elles suivent le mode clair comme le sombre.
 *
 * `composantes` ajoute la composante rapide (λ = 0,94) et la lente
 * (250 séances). Une séance sans valeur coupe le tracé, elle n'est jamais
 * reliée par une droite qui ferait croire à une mesure.
 */
export default function CourbeNervosite({
  lignes,
  composantes = false,
  compacte = false,
  reperes: typeReperes = 'annees',
  titre,
}: {
  lignes: readonly LigneNervosite[];
  composantes?: boolean;
  compacte?: boolean;
  /** Repères de l'axe horizontal : début de chaque année, ou de chaque trimestre. */
  reperes?: 'annees' | 'trimestres';
  /** Nom accessible du graphique. */
  titre: string;
}) {
  const cles: ('valeur' | 'rapide' | 'lente')[] = composantes ? ['valeur', 'rapide', 'lente'] : ['valeur'];
  const e = etendue(lignes, cles);
  if (!e || lignes.length < 2) return null;

  const W = compacte ? 240 : 960;
  const H = compacte ? 56 : 300;
  const G = compacte ? { l: 2, r: 2, t: 4, b: 4 } : { l: 44, r: 12, t: 12, b: 26 };
  const pas = pasGraduation(e.max);
  const haut = compacte ? e.max : Math.ceil(e.max / pas) * pas;
  const bas = compacte ? e.min : 0;
  const n = lignes.length;
  const x = (i: number) => G.l + (i / (n - 1)) * (W - G.l - G.r);
  const y = (v: number) => G.t + (1 - (v - bas) / (haut - bas || 1)) * (H - G.t - G.b);

  const trace = (k: 'valeur' | 'rapide' | 'lente') => {
    let d = '';
    let ouvert = false;
    lignes.forEach((l, i) => {
      const v = l[k];
      if (v === null) { ouvert = false; return; }
      d += `${ouvert ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      ouvert = true;
    });
    return d.trim();
  };

  const graduations: number[] = [];
  if (!compacte) for (let v = 0; v <= haut + 1e-9; v += pas) graduations.push(v);
  const reperes = compacte ? [] : typeReperes === 'annees' ? reperesAnnees(lignes) : reperesTrimestres(lignes);
  const derniere = [...lignes].reverse().find((l) => l.valeur !== null);
  const iDerniere = derniere ? lignes.lastIndexOf(derniere) : -1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={compacte ? 'block h-full w-full' : 'h-auto w-full'} role="img" aria-label={titre} preserveAspectRatio={compacte ? 'none' : undefined}>
      {graduations.map((v) => (
        <g key={v}>
          <line x1={G.l} x2={W - G.r} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} />
          <text x={G.l - 8} y={y(v) + 3.5} textAnchor="end" className="fill-faint" fontSize={11}>{v} %</text>
        </g>
      ))}
      {reperes.map((r) => (
        <text key={r.i} x={x(r.i)} y={H - 7} textAnchor="middle" className="fill-faint" fontSize={11}>{r.annee}</text>
      ))}
      {composantes && (
        <>
          <path d={trace('lente')} fill="none" className="stroke-warn" strokeWidth={1.5} strokeDasharray="5 4" strokeLinejoin="round" />
          <path d={trace('rapide')} fill="none" className="stroke-muted" strokeWidth={1} strokeLinejoin="round" opacity={0.75} />
        </>
      )}
      <path d={trace('valeur')} fill="none" className="stroke-accent" strokeWidth={compacte ? 1.5 : 2} strokeLinejoin="round" vectorEffect={compacte ? 'non-scaling-stroke' : undefined} />
      {!compacte && derniere && (
        <g>
          <circle cx={x(iDerniere)} cy={y(derniere.valeur!)} r={4} className="fill-accent stroke-bg" strokeWidth={2} />
          <title>{`${fmtNervosite(derniere.valeur!)} le ${fmtDateFR(derniere.date_marche)}`}</title>
        </g>
      )}
    </svg>
  );
}

/** Pas de graduation lisible (5, 10 ou 20 points). */
function pasGraduation(max: number): number {
  if (max <= 25) return 5;
  if (max <= 60) return 10;
  return 20;
}

/** Première séance de chaque année, une année sur `saut` pour rester lisible. */
function reperesAnnees(lignes: readonly LigneNervosite[]): { i: number; annee: string }[] {
  const premieres: { i: number; annee: string }[] = [];
  let prec = '';
  lignes.forEach((l, i) => {
    const a = l.date_marche.slice(0, 4);
    if (a !== prec && i > 0) premieres.push({ i, annee: a });
    prec = a;
  });
  const saut = premieres.length > 12 ? 3 : premieres.length > 6 ? 2 : 1;
  return premieres.filter((_, k) => k % saut === 0);
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Première séance de chaque trimestre civil. */
function reperesTrimestres(lignes: readonly LigneNervosite[]): { i: number; annee: string }[] {
  const out: { i: number; annee: string }[] = [];
  let prec = '';
  lignes.forEach((l, i) => {
    const m = Number(l.date_marche.slice(5, 7)) - 1;
    const cle = `${l.date_marche.slice(0, 4)}-${Math.floor(m / 3)}`;
    if (cle !== prec && i > 0) out.push({ i, annee: `${MOIS[m]} ${l.date_marche.slice(2, 4)}` });
    prec = cle;
  });
  return out;
}
