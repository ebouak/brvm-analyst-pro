import CourbeNervosite from './CourbeNervosite';
import { fmtNervosite, LIBELLE_REGIME, TON_REGIME } from '@/lib/nervosite/affichage';
import type { ResumeNervosite } from '@/lib/nervosite/lecture';
import { fmtDateFR } from '@/lib/format';

/**
 * Aperçu de l'indice WESTBOURSE pour le tableau de bord (contenu d'une « porte »
 * vers /nervosite : aucun lien à l'intérieur). Composant serveur, sans état.
 * Données absentes ou historique trop court : le bloc le dit, sans chiffre.
 */
export default function ApercuNervosite({ resume, dateMarche }: { resume: ResumeNervosite | null; dateMarche: string }) {
  if (!resume) return <p className="text-sm text-muted">Indice de nervosité indisponible pour le moment.</p>;
  const { derniere, courbe } = resume;
  if (derniere.valeur === null) {
    return <p className="text-sm text-muted">Historique encore insuffisant pour calculer l’indice (250 séances nécessaires).</p>;
  }
  return (
    <>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
        <span className="tabular text-lg font-semibold leading-none text-ivory">{fmtNervosite(derniere.valeur)}</span>
        <span className="text-xs text-muted">annualisé</span>
        {derniere.regime && (
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TON_REGIME[derniere.regime]}`}>
            {LIBELLE_REGIME[derniere.regime]}
          </span>
        )}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">
        Volatilité réalisée annualisée : elle mesure l’ampleur des variations récentes, pas leur sens.
      </p>
      {courbe.length >= 2 && (
        <div className="mt-2 h-10">
          <CourbeNervosite lignes={courbe} compacte titre={`Indice de nervosité WESTBOURSE sur ${courbe.length} séances`} />
        </div>
      )}
      <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
        {derniere.regime
          ? <>Dans son historique récent (cinq ans au plus), le niveau actuel égale ou dépasse celui de {Math.round(derniere.rang!)} % des séances.</>
          : 'Régime non classé : historique de l’indice trop court'}
        {derniere.date_marche !== dateMarche && (
          <span className="text-warn"> · séance du {fmtDateFR(derniere.date_marche)}</span>
        )}
      </p>
    </>
  );
}
