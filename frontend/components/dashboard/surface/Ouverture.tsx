import { fmtNumber, fmtFcfa, fmtPctSigne, fmtDateFR } from '@/lib/format';
import BriefAssistant from '@/components/dashboard/BriefAssistant';

export interface Chiffre { libelle: string; valeur: string; variation: number | null; note?: string }

const ton = (v: number | null) => (v == null ? 'text-faint' : v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-muted');

/** Spec §12 — la séance racontée : titre tiré des chiffres, chapô, six mesures. */
export default function Ouverture({ dateMarche, titre, chapo, chiffres }: {
  dateMarche: string; titre: string | null; chapo: string; chiffres: Chiffre[];
}) {
  const jour = new Date(`${dateMarche}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (
    <section aria-labelledby="titre-seance" className="grid gap-8 py-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-end lg:px-5">
      <div className="min-w-0">
        <p className="overline text-faint">{jour}</p>
        <h2 id="titre-seance" className="mt-2 font-display text-[clamp(28px,3.1vw,40px)] leading-[1.08] tracking-tight text-ivory [text-wrap:balance]">
          {titre ?? `Séance du ${fmtDateFR(dateMarche)}`}
        </h2>
        {chapo && <p className="mt-2.5 max-w-[60ch] text-[15px] text-muted">{chapo}</p>}
        <div className="mt-3.5"><BriefAssistant /></div>
      </div>
      <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-border sm:grid-cols-3">
        {chiffres.map((c) => (
          <div key={c.libelle} className="min-w-0 border-b border-r border-border px-3.5 py-3">
            <dt className="overline text-faint">{c.libelle}</dt>
            <dd className="tabular mt-1.5 text-[19px] text-ivory">{c.valeur}</dd>
            <dd className={`tabular mt-0.5 text-xs ${ton(c.variation)}`}>
              {c.variation != null ? `${fmtPctSigne(c.variation)}${c.note ? ` ${c.note}` : ''}` : (c.note ?? '—')}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Formatage partagé des six mesures. */
export const fmtIndice = (v: number | null) => (v == null ? '—' : fmtNumber(v, 2));
export const fmtMd = (v: number | null) => (v == null ? '—' : `${fmtFcfa(v)} FCFA`);
