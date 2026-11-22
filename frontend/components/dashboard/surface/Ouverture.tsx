import type { ComponentProps } from 'react';
import { fmtNumber, fmtFcfa, fmtDateFR } from '@/lib/format';
import BriefAssistant from '@/components/dashboard/BriefAssistant';
import ChiffresSeance from './ChiffresSeance';
import BilanSeance from './BilanSeance';
import type { IndiceDirect } from '@/lib/realtime/indices';
import type { PointCourbe } from '@/lib/realtime/courbe';

export interface Chiffre {
  libelle: string; valeur: string; variation: number | null; note?: string;
  /** Code d'indice : la mesure suit alors la séance en direct (ChiffresSeance). */
  indice?: string;
}

type Bilan = Omit<ComponentProps<typeof BilanSeance>, 'dateMarche'>;

/** Spec §12 — la séance racontée : titre tiré des chiffres, chapô, six mesures. */
export default function Ouverture({ dateMarche, titre, chapo, chiffres, indices = [], courbes, veilles, bilan = null }: {
  dateMarche: string; titre: string | null; chapo: string; chiffres: Chiffre[];
  indices?: IndiceDirect[];
  /** Points du jour des indices (relevés réels), par code. */
  courbes?: Record<string, PointCourbe[]>;
  /** Valeur de la veille des indices, par code. */
  veilles?: Record<string, number | null>;
  /** Bilan animé, fourni une fois la séance terminée. */
  bilan?: Bilan | null;
}) {
  const jour = new Date(`${dateMarche}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (
    <section aria-labelledby="titre-seance" className="grid gap-8 py-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-end lg:px-5">
      <div className="min-w-0">
        <h2 id="titre-seance" className="font-display text-[clamp(28px,3.1vw,40px)] leading-[1.08] tracking-tight text-ivory [text-wrap:balance]">
          {titre ?? `Séance du ${fmtDateFR(dateMarche)}`}
        </h2>
        <p className="overline mt-1.5 text-faint">{jour}</p>
        {chapo && <p className="mt-2.5 max-w-[60ch] text-[15px] text-muted">{chapo}</p>}
        <div className="mt-3.5"><BriefAssistant /></div>
        {bilan && <BilanSeance dateMarche={dateMarche} {...bilan} />}
      </div>
      <ChiffresSeance chiffres={chiffres} indices={indices} dateMarche={dateMarche} courbes={courbes} veilles={veilles} />
    </section>
  );
}

/** Formatage partagé des six mesures. */
export const fmtIndice = (v: number | null) => (v == null ? '—' : fmtNumber(v, 2));
export const fmtMd = (v: number | null) => (v == null ? '—' : `${fmtFcfa(v)} FCFA`);
