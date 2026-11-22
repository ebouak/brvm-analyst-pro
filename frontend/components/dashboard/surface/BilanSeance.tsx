'use client';

import { fmtDateCourte, fmtFcfa, fmtNumber, fmtPctSigne } from '@/lib/format';
import { ChiffreRoulant } from '@/components/ui/ChiffreRoulant';

const ton = (v: number | null) => (v == null ? 'text-faint' : v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-muted');
const entier = (x: number) => String(Math.round(x));

/**
 * Bilan animé de la séance, affiché une fois la séance terminée. Les chiffres
 * se révèlent en roulant depuis zéro et la barre de largeur du marché se
 * déploie ; tous sont ceux que le tableau de bord a déjà chargés.
 *
 * « Séance terminée » est une indication d'HORAIRE (estSeanceClose), pas la
 * confirmation officielle de clôture : d'où « chiffres de la dernière collecte ».
 */
export default function BilanSeance({ dateMarche, composite, hausses, baisses, inchangees, valeurEchangee }: {
  dateMarche: string;
  composite: { valeur: number; variationPct: number } | null;
  hausses: number | null;
  baisses: number | null;
  inchangees: number | null;
  valeurEchangee: number | null;
}) {
  if (hausses == null || baisses == null) return null;
  const stables = inchangees ?? 0;
  const total = hausses + baisses + stables;
  if (total === 0) return null;
  const part = (n: number) => `${(n / total) * 100}%`;

  return (
    <section aria-labelledby="bilan-seance" className="mt-5 rounded-xl border border-border bg-surface/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id="bilan-seance" className="text-sm font-semibold text-ivory">
          Bilan de la séance du {fmtDateCourte(dateMarche)}
        </h3>
        <span className="text-[11px] text-faint">Séance terminée · chiffres de la dernière collecte</span>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        {composite && (
          <div>
            <p className="text-[11px] text-faint">BRVM Composite</p>
            <p className="tabular text-2xl text-ivory">
              <ChiffreRoulant depuisZero valeur={composite.valeur} format={(x) => fmtNumber(x, 2)} />
            </p>
            <p className={`tabular text-xs ${ton(composite.variationPct)}`}>{fmtPctSigne(composite.variationPct)}</p>
          </div>
        )}
        <div className="min-w-0">
          <div
            className="bilan-barre flex h-2.5 overflow-hidden rounded-full bg-border"
            role="img"
            aria-label={`${hausses} hausses, ${stables} inchangées, ${baisses} baisses sur ${total} valeurs`}
          >
            <span className="bg-up" style={{ width: part(hausses) }} />
            <span className="bg-muted/40" style={{ width: part(stables), animationDelay: '140ms' }} />
            <span className="bg-down" style={{ width: part(baisses), animationDelay: '280ms' }} />
          </div>
          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
            <div className="flex gap-1.5"><dt className="text-faint">Hausses</dt><dd className="tabular text-up"><ChiffreRoulant depuisZero valeur={hausses} format={entier} /></dd></div>
            <div className="flex gap-1.5"><dt className="text-faint">Inchangées</dt><dd className="tabular text-muted"><ChiffreRoulant depuisZero valeur={stables} format={entier} /></dd></div>
            <div className="flex gap-1.5"><dt className="text-faint">Baisses</dt><dd className="tabular text-down"><ChiffreRoulant depuisZero valeur={baisses} format={entier} /></dd></div>
            {valeurEchangee != null && (
              <div className="flex gap-1.5"><dt className="text-faint">Valeur échangée</dt><dd className="tabular text-ivory">{fmtFcfa(valeurEchangee)} FCFA</dd></div>
            )}
          </dl>
        </div>
      </div>
    </section>
  );
}
