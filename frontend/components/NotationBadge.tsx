import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import { titrePublication } from '@/lib/fiche/affichage';
import {
  dernieresNotations,
  libellePerspective,
  logoAgence,
  syntheseNotation,
  type Variation,
} from '@/lib/fiche/notation';
import type { Publication } from './PublicationsModal';

interface HistoryEntry {
  note: string;
  court_terme?: string | null;
  long_terme?: string | null;
  perspective: string;
  date_notation: string;
}

interface NotationProps {
  notation: {
    agence: string;
    note: string;
    perspective: string;
    date_notation: string;
    source_url?: string;
    court_terme?: string | null;
    long_terme?: string | null;
    history?: HistoryEntry[];
  };
  notationPubs?: Publication[];
}

function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
}

function Fleche({ v }: { v: Variation }) {
  if (v === 'hausse') return <ArrowUp className="h-3.5 w-3.5 text-up" aria-label="en hausse" />;
  if (v === 'baisse') return <ArrowDown className="h-3.5 w-3.5 text-down" aria-label="en baisse" />;
  if (v === 'stable') return <ArrowRight className="h-3.5 w-3.5 text-muted" aria-label="inchangée" />;
  return null;
}

function Pastille({ perspective }: { perspective: string }) {
  const p = libellePerspective(perspective);
  if (!p) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-border-strong px-2.5 py-0.5 text-xs text-ivory">
      {p}
    </span>
  );
}

export default function NotationBadge({ notation, notationPubs = [] }: NotationProps) {
  const { agence } = notation;

  const entries: HistoryEntry[] = notation.history && notation.history.length > 0
    ? notation.history
    : [{
        note: notation.note,
        court_terme: notation.court_terme ?? null,
        long_terme: notation.long_terme ?? null,
        perspective: notation.perspective,
        date_notation: notation.date_notation,
      }];

  const ordonnees = dernieresNotations(entries, entries.length);
  const latest = ordonnees[0];
  const persp = latest.perspective ?? notation.perspective;
  const synthese = syntheseNotation(latest.note, persp, ordonnees);
  const recentes = ordonnees.slice(0, 3);
  const logo = logoAgence(agence);
  const docs = notationPubs.slice(0, 3);
  const longTerme = latest.long_terme ?? null;
  const courtTerme = latest.court_terme ?? null;
  const perspLib = libellePerspective(persp);

  return (
    <section aria-label="Notation financière" className="space-y-5 rounded-xl border border-border bg-surface p-4 sm:p-5">
      {/* Ligne haute : agence + note, puis détail long / court terme */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          {logo && (
            // Logo officiel, sombre sur fond transparent : posé sur pastille blanche.
            <span className="flex h-12 shrink-0 items-center rounded-lg bg-white px-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt={agence} className="h-8 w-auto" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-xs text-muted">Notation financière</p>
            <p className="text-sm font-medium text-ivory">{agence}</p>
          </div>
          <div className="flex items-center gap-3 sm:border-l sm:border-border sm:pl-4">
            <span className="tabular text-4xl font-bold leading-none text-ivory sm:text-5xl">{latest.note}</span>
            <Pastille perspective={persp} />
          </div>
        </div>

        {(longTerme || courtTerme) && (
          <dl className="space-y-1 text-sm text-muted">
            {longTerme && (
              <div className="flex flex-wrap items-baseline gap-x-2">
                <dt>Long terme :</dt>
                <dd className="font-semibold text-ivory">
                  <span className="tabular">{longTerme}</span>
                  {perspLib && <span className="ml-2 font-normal text-muted">perspective {perspLib}</span>}
                </dd>
              </div>
            )}
            {courtTerme && (
              <div className="flex flex-wrap items-baseline gap-x-2">
                <dt>Court terme :</dt>
                <dd className="font-semibold text-ivory">
                  <span className="tabular">{courtTerme}</span>
                  {perspLib && <span className="ml-2 font-normal text-muted">perspective {perspLib}</span>}
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>

      <p className="text-sm text-muted">{synthese}</p>

      {(recentes.length > 1 || docs.length > 0) && (
        <div className="grid gap-5 border-t border-border/60 pt-4 lg:grid-cols-2">
          {recentes.length > 1 && (
            <div>
              <h3 className="mb-2 text-xs text-faint">Évolution</h3>
              <ol className="grid grid-cols-3 gap-2">
                {recentes.map((e) => (
                  <li key={e.date_notation + e.note} className="rounded-lg border border-border/60 px-2.5 py-2">
                    <p className="text-xs text-muted">{dateCourte(e.date_notation)}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm">
                      <span className="tabular font-semibold text-ivory">{e.note}</span>
                      <Fleche v={e.variation} />
                    </p>
                    {libellePerspective(e.perspective) && (
                      <p className="text-xs text-faint">{libellePerspective(e.perspective)}</p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {docs.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs text-faint">Documents officiels</h3>
              <ul className="space-y-1">
                {docs.map((pub) => {
                  const titre = titrePublication(pub.libelle);
                  const date = dateCourte(pub.date_publication);
                  return (
                    <li key={pub.id} className="flex min-h-[44px] items-center justify-between gap-3">
                      <span className="min-w-0 text-xs text-muted">
                        <span className="tabular">{date}</span> — {titre}
                      </span>
                      {pub.source_url ? (
                        <a
                          href={pub.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Voir le document : ${titre}, ${date}`}
                          className="inline-flex min-h-[44px] shrink-0 items-center px-2 text-xs text-accent-ink underline-offset-2 hover:underline"
                        >
                          Voir
                        </a>
                      ) : (
                        <span className="shrink-0 px-2 text-xs text-faint">Indisponible</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
