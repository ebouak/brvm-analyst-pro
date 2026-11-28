import Link from 'next/link';
import { Apparition } from './mouvement/Apparition';
import { pointsCourbe } from '@/lib/vitrine/landingPur';
import { fmtDateCourte } from '@/lib/format';
import type { DonneesThermometre } from '@/lib/vitrine/thermometre';

const PAS_CONSEIL = 'Pas un conseil en investissement.';

/** Le thermomètre du marché (spec 2026-11-28) : textes issus de lib/stress/bulletin.ts ; absent sans donnée. */
export function SectionThermometre({ t }: { t: DonneesThermometre | null }) {
  if (!t) return null;
  const b = t.bulletin;
  const pos = Math.min(100, Math.max(0, b.note));
  const points = pointsCourbe(t.serie, 600, 90);
  return (
    <section id="thermometre" className="bande-sombre v-bloc v-bloc--serre" aria-labelledby="h-thermometre">
      <div className="v-colonne">
        <Apparition className="v-tete-section">
          <p className="v-surtitre">Le thermomètre du marché</p>
          <h2 id="h-thermometre" className="v-section v-section--petit">
            Le marché est-il nerveux ? <span className="vitrine-accent">{b.reponse}</span>
          </h2>
        </Apparition>
        <div className="v-thermo">
          <p className="v-thermo-note v-mono">
            {b.note}
            <span className="v-thermo-sur">/100</span>
          </p>
          <div
            className="v-thermo-jauge"
            role="meter"
            aria-label="Indice de tension du marché"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pos}
            aria-valuetext={`${pos} sur 100, tension ${b.niveau}`}
          >
            <span className="v-thermo-repere" style={{ left: `${pos}%` }} aria-hidden="true" />
          </div>
          <p className="v-thermo-phrase">
            Tension {b.niveau}.{t.phrase ? ` ${t.phrase}` : ''}
          </p>
          {points && (
            <svg className="v-thermo-courbe" viewBox="0 0 600 90" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={points} />
            </svg>
          )}
          <p className="v-note">
            Séance du {fmtDateCourte(t.date)} · indice de tension WESTBOURSE, calculé chaque soir depuis les cours de la
            BRVM. {PAS_CONSEIL}
          </p>
          <Link href="/stress-monitor" className="v-bouton-second v-thermo-lien">
            Comprendre la tension du marché
          </Link>
        </div>
      </div>
    </section>
  );
}
