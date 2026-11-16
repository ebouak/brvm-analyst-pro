import { fmtDateCourte, fmtFcfa, fmtPctAbs, fmtPctSigne } from '@/lib/format';
import { MiniGraphiqueMoyennes } from '@/components/fiche/MiniGraphiqueMoyennes';
import type { DatedClose, MovingAverageReading } from '@/lib/movingAverages';
import type { SectorBreadthResult } from '@/lib/movingAverages/server';

interface Moyenne {
  label: string;
  fenetre: number;
  valeur: number | null;
  ecart: number | null;
  pente: number | null;
}

interface Props {
  reading: MovingAverageReading;
  points: DatedClose[];
  breadth: SectorBreadthResult;
  secteur: string | null;
  dateDernierCours: string | null;
  dateSeance: string;
  seancesSansCotation: number | null;
}

function MoyenneCard({ label, fenetre, valeur, ecart, pente }: Moyenne) {
  return (
    <article className="rounded-card border border-border bg-bg/50 p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-ivory">{label}</h4>
        <span className="text-[11px] text-faint">{fenetre} séances</span>
      </div>
      <p className="tabular mt-3 text-lg font-medium text-ivory">
        {valeur == null ? '—' : `${fmtFcfa(valeur)} FCFA`}
      </p>
      {valeur == null ? (
        <p className="mt-2 text-xs leading-relaxed text-faint">
          {fenetre} clôtures valides nécessaires.
        </p>
      ) : (
        <dl className="mt-3 space-y-1.5 border-t border-border/70 pt-2.5 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Cours vs moyenne</dt>
            <dd className="tabular text-ivory">{ecart == null ? '—' : fmtPctSigne(ecart)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Variation de la moyenne · 5 séances</dt>
            <dd className="tabular text-ivory">{pente == null ? '—' : fmtPctSigne(pente)}</dd>
          </div>
        </dl>
      )}
    </article>
  );
}

function BreadthLine({
  label,
  measure,
}: {
  label: string;
  measure: { above: number; total: number; percent: number | null };
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border/70 py-2.5 text-xs first:border-t-0">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular text-ivory">
        {measure.above} / {measure.total}
        {measure.percent == null
          ? <span className="ml-2 text-faint">Données insuffisantes · 3 titres minimum</span>
          : <span className="ml-2 text-accent-ink">{fmtPctAbs(measure.percent, 2)}</span>}
      </dd>
    </div>
  );
}

export function MoyennesMobiles({
  reading,
  points,
  breadth,
  secteur,
  dateDernierCours,
  dateSeance,
  seancesSansCotation,
}: Props) {
  const moyennes: Moyenne[] = [
    { label: 'Moyenne mobile', fenetre: 20, valeur: reading.sma20, ecart: reading.distance20Pct, pente: reading.slope20Pct },
    { label: 'Moyenne mobile', fenetre: 50, valeur: reading.sma50, ecart: reading.distance50Pct, pente: reading.slope50Pct },
    { label: 'Moyenne mobile', fenetre: 200, valeur: reading.sma200, ecart: reading.distance200Pct, pente: reading.slope200Pct },
  ];

  return (
    <section aria-labelledby="moyennes-mobiles-title" className="rounded-card border border-border bg-surface p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="moyennes-mobiles-title" className="text-base font-semibold text-ivory">Moyennes mobiles</h3>
        <span className="rounded-full border border-accent/30 px-2.5 py-1 text-[11px] text-accent-ink">Lecture descriptive</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <p>
          Dernière clôture : <span className="text-ivory">{dateDernierCours ? fmtDateCourte(dateDernierCours) : 'indisponible'}</span>
        </p>
        <p>
          Séance de référence : <span className="text-ivory">{fmtDateCourte(dateSeance)}</span>
        </p>
        {reading.close != null && <p className="tabular">Cours : {fmtFcfa(reading.close)} FCFA</p>}
        <p className="tabular">{reading.observations} clôtures valides dans l&apos;historique analysé</p>
      </div>

      {seancesSansCotation != null && seancesSansCotation > 0 && (
        <p className="mt-2 rounded border border-border bg-bg/40 px-3 py-2 text-xs text-muted">
          {seancesSansCotation} séance{seancesSansCotation > 1 ? 's' : ''} sans nouvelle clôture depuis la dernière observation.
        </p>
      )}

      <MiniGraphiqueMoyennes points={points} reading={reading} asOfDate={dateSeance} />

      <p className="mt-4 text-xs leading-relaxed text-faint">
        L&apos;écart compare la dernière clôture à la moyenne ; sa variation compare la moyenne actuelle à celle d&apos;il y a 5 séances.
      </p>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {moyennes.map((moyenne) => <MoyenneCard key={moyenne.label} {...moyenne} />)}
      </div>

      {reading.crossover && (
        <div className="mt-4 rounded-card border border-border/80 bg-bg/35 px-3.5 py-3">
          <p className="text-xs leading-relaxed text-muted">
            Croisement des moyennes 20/50 séances observé {reading.crossover === 'haussier' ? 'à la hausse' : 'à la baisse'} : {fmtDateCourte(reading.date)}.
          </p>
        </div>
      )}

      <div className="mt-4">
        <h4 className="text-xs font-semibold text-ivory">
          Largeur sectorielle{secteur ? ` · ${secteur}` : ''}
        </h4>
        {secteur && breadth.status === 'insufficient' && breadth.reading && (
          <p className="mt-1 text-[11px] text-faint">Données sectorielles insuffisantes pour une lecture agrégée.</p>
        )}
        {secteur && breadth.reading ? (
          <dl className="mt-1">
            <BreadthLine label="Cours au-dessus de la SMA 50" measure={breadth.reading.sma50Above} />
            <BreadthLine label="Cours au-dessus de la SMA 200" measure={breadth.reading.sma200Above} />
          </dl>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-faint">
            Données sectorielles insuffisantes{secteur ? '.' : ' : secteur non renseigné dans le référentiel.'}
          </p>
        )}
      </div>

      <p className="mt-4 border-t border-border/70 pt-3 text-[11px] leading-relaxed text-faint">
        Indicateurs descriptifs, non prédictifs. Les moyennes mobiles retardent par construction les mouvements de cours.
      </p>
    </section>
  );
}
