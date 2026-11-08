import { fmtFcfa } from '@/lib/format';

interface Props {
  resultatExploitation: number;
  horsExploitation: number;
  resultatAvantImpot: number;
  impot: number;
  resultatNet: number;
}

const VERT = 'rgb(var(--color-up))';
const ROUGE = 'rgb(var(--color-down))';
const GRIS = 'rgb(var(--color-muted))';

interface Barre { libelle: string; debut: number; fin: number; total: boolean }

/**
 * Cascade exploitation → hors exploitation → avant impôt → impôt → net.
 * Barres flottantes en SVG pur (rendu serveur, lisible à l'impression).
 * Rendue seulement si les cinq montants existent.
 */
export default function CascadeResultat(p: Props) {
  const barres: Barre[] = [
    { libelle: "Résultat d'exploitation", debut: 0, fin: p.resultatExploitation, total: true },
    { libelle: 'Hors exploitation', debut: p.resultatExploitation, fin: p.resultatAvantImpot, total: false },
    { libelle: 'Avant impôt', debut: 0, fin: p.resultatAvantImpot, total: true },
    { libelle: 'Impôt', debut: p.resultatAvantImpot, fin: p.resultatNet, total: false },
    { libelle: 'Résultat net', debut: 0, fin: p.resultatNet, total: true },
  ];
  const vals = barres.flatMap((b) => [b.debut, b.fin]);
  const max = Math.max(...vals, 0), min = Math.min(...vals, 0);
  const etendue = max - min || 1;
  const W = 640, H = 220, haut = 28, bas = 48, zone = H - haut - bas;
  const y = (v: number) => haut + ((max - v) / etendue) * zone;
  const pas = W / barres.length, larg = pas * 0.5;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
      aria-label={`Cascade du résultat : exploitation ${fmtFcfa(p.resultatExploitation)}, hors exploitation ${fmtFcfa(p.horsExploitation)}, avant impôt ${fmtFcfa(p.resultatAvantImpot)}, impôt ${fmtFcfa(p.impot)}, net ${fmtFcfa(p.resultatNet)}`}>
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="rgb(var(--color-faint))" strokeWidth={1} />
      {barres.map((b, i) => {
        const x = i * pas + (pas - larg) / 2;
        const y1 = y(Math.max(b.debut, b.fin)), y2 = y(Math.min(b.debut, b.fin));
        const delta = b.fin - b.debut;
        const couleur = b.total ? GRIS : delta >= 0 ? VERT : ROUGE;
        const valeur = b.total ? b.fin : delta;
        return (
          <g key={b.libelle}>
            <rect x={x} y={y1} width={larg} height={Math.max(y2 - y1, 1.5)} fill={couleur} rx={2} />
            <text x={x + larg / 2} y={y1 - 6} textAnchor="middle" fontSize={12} fill="rgb(var(--color-ivory))">
              {valeur > 0 && !b.total ? '+' : ''}{fmtFcfa(valeur)}
            </text>
            <text x={x + larg / 2} y={H - 22} textAnchor="middle" fontSize={12} fill="rgb(var(--color-muted))">{b.libelle}</text>
          </g>
        );
      })}
    </svg>
  );
}
