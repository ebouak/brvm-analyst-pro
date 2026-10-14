import { comprendreSeance, type MetriquesSeance } from '@/lib/dashboard/comprendre';
import { CadreBloc, EtatVide } from './Cadre';

/** Spec §4.4 — constats déterministes, affichés seulement une fois la séance close. */
export default function BlocComprendre({ metriques, close }: { metriques: MetriquesSeance | null; close: boolean }) {
  const constats = metriques && close ? comprendreSeance(metriques) : [];
  return (
    <CadreBloc
      id="bloc-comprendre"
      titre="Comprendre la séance"
      dateReference={metriques?.dateMarche ?? null}
      legendeDate="Séance du"
      lien={{ href: '/formations', label: "Apprendre avec l'Academy" }}
    >
      {!close ? (
        <EtatVide message="La séance n'est pas encore close ; l'explication paraît après la clôture." />
      ) : constats.length === 0 ? (
        <EtatVide message="Pas assez de données pour expliquer cette séance." />
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {constats.map((c, i) => (
            <li key={c.id} className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-border/60 bg-bg/40 p-3">
              <span className="tabular text-xs font-semibold text-accent-ink">{i + 1}</span>
              <p className="text-sm leading-snug text-ivory">{c.texte}</p>
              <p className="text-xs leading-snug text-muted">{c.sens}</p>
            </li>
          ))}
        </ol>
      )}
    </CadreBloc>
  );
}
