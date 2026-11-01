// frontend/app/admin/crm/IndicateursBandeau.tsx — quatre indicateurs du portefeuille (spec CRM v2 §2.5).
import type { Indicateurs } from '@/lib/crm/indicateurs';
import { fmtFcfa } from '@/lib/crm/score';

/** Pourcentage seulement si le dénominateur est assez grand pour ne pas tromper. */
const SEUIL_POURCENTAGE = 5;

function Carte({ titre, valeur, detail }: { titre: string; valeur: string; detail: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <p className="text-xs text-muted">{titre}</p>
      <p className="tabular mt-2 text-2xl font-semibold text-ivory">{valeur}</p>
      <p className="mt-1 text-xs text-faint">{detail}</p>
    </div>
  );
}

export default function IndicateursBandeau({ i }: { i: Indicateurs }) {
  const { montantPotentiel: m, conversions: c } = i;
  const sans = `${m.sansMontant} opportunité${m.sansMontant > 1 ? 's' : ''} sans montant${m.autresDevises > 0 ? ` (dont ${m.autresDevises} en autre devise)` : ''}`;
  const conv = c.relances === 0
    ? { valeur: '—', detail: 'aucune relance sur la période' }
    : {
        valeur: `${c.converties} sur ${c.relances}${c.relances >= SEUIL_POURCENTAGE ? ` · ${Math.round((c.converties / c.relances) * 100)} %` : ''}`,
        detail: `paiement dans les ${c.fenetreJours} j suivant la 1re relance, relances des ${c.periodeJours} derniers jours — après, pas nécessairement grâce à`,
      };
  return (
    <section aria-label="Indicateurs du CRM" className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Carte titre="Prospects à traiter" valeur={String(i.aTraiter)} detail="échéance atteinte, réponse en attente ou silence prolongé" />
        <Carte titre="Opportunités ouvertes" valeur={String(i.ouvertes)} detail="ni convertis ni clôturés" />
        <Carte titre="Montant potentiel" valeur={fmtFcfa(m.total)} detail={sans} />
        <Carte titre="Conversions après relance" valeur={conv.valeur} detail={conv.detail} />
      </div>
      <p className="text-xs text-faint">Calculés sur tout le portefeuille (administrateurs exclus), avant les filtres Niveau, Responsable et Recherche.</p>
    </section>
  );
}
