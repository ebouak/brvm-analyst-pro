import { fmtFcfa } from '@/lib/format';

interface Props {
  resultatExploitation: number;
  horsExploitation: number;
  resultatAvantImpot: number;
  impot: number;
  resultatNet: number;
}

interface Barre { libelle: string; debut: number; fin: number; total: boolean }

const HAUTEUR_BARRES = 120;

/**
 * Cascade exploitation → hors exploitation → avant impôt → impôt → net.
 * Barres en HTML/CSS (rendu serveur, lisible à l'impression) : les textes gardent
 * leur taille réelle quelle que soit la largeur, contrairement à un SVG mis à l'échelle.
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
  const pct = (v: number) => ((max - v) / etendue) * 100;
  return (
    <div
      role="img"
      aria-label={`Cascade du résultat : exploitation ${fmtFcfa(p.resultatExploitation)}, hors exploitation ${fmtFcfa(p.horsExploitation)}, avant impôt ${fmtFcfa(p.resultatAvantImpot)}, impôt ${fmtFcfa(p.impot)}, net ${fmtFcfa(p.resultatNet)}`}
      className="grid grid-cols-5 gap-x-2"
    >
      {barres.map((b) => {
        const delta = b.fin - b.debut;
        const valeur = b.total ? b.fin : delta;
        const haut = pct(Math.max(b.debut, b.fin)), bas = pct(Math.min(b.debut, b.fin));
        const couleur = b.total ? 'bg-muted' : delta >= 0 ? 'bg-up' : 'bg-down';
        return (
          <div key={b.libelle} className="flex min-w-0 flex-col">
            <div className="relative" style={{ height: HAUTEUR_BARRES }} aria-hidden>
              <div className="absolute inset-x-[20%] rounded-sm" style={{ top: `${haut}%`, height: `max(${bas - haut}%, 2px)` }}>
                <div className={`h-full w-full rounded-sm ${couleur}`} />
              </div>
              <div className="absolute inset-x-0 border-t border-faint" style={{ top: `${pct(0)}%` }} />
            </div>
            <p className="tabular mt-1 text-center text-xs text-ivory">
              {valeur > 0 && !b.total ? '+' : ''}{fmtFcfa(valeur)}
            </p>
            <p className="mt-0.5 text-center text-xs leading-tight text-muted">{b.libelle}</p>
          </div>
        );
      })}
    </div>
  );
}
