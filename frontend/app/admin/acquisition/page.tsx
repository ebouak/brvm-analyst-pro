import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, PremiumPanel } from '@/components/ui/premium';
import { lireAcquisition, JOURS_ACQUISITION } from '@/lib/acquisition/lecture';
import { fmtDateFR } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Acquisition par source — Administration' };

const n = (x: number) => x.toLocaleString('fr-FR').replace(/[  ]/g, ' ');

/**
 * Acquisition par source : visites des liens de suivi /chaine et /telegram,
 * inscriptions venues de /signup?src=. Compteur AGRÉGÉ (migration 0251) :
 * aucune personne derrière une ligne, seulement une étiquette de campagne.
 * Une visite comptée n'est pas un abonnement : WhatsApp et Telegram ne nous
 * disent pas qui s'abonne ensuite.
 */
export default async function Page() {
  await requirePermission('crm.read');
  const r = await lireAcquisition();
  const total = r.ok
    ? r.sources.reduce((t, s) => ({ c: t.c + s.visitesChaine, t: t.t + s.visitesTelegram, i: t.i + s.inscriptions }), { c: 0, t: 0, i: 0 })
    : null;
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        title="Acquisition par source"
        subtitle={`Liens de suivi de la Chaîne WhatsApp, du canal Telegram et de l’inscription, sur ${JOURS_ACQUISITION} jours.`}
      />
      <div className="gold-rule" />
      <PremiumPanel className="p-5 space-y-4">
        {!r.ok ? (
          <p className="text-sm text-warn">
            Lecture impossible ({r.raison}). Rien ne peut être affirmé sur les sources tant que la table{' '}
            <code className="tabular">acquisition_compteurs</code> (migration 0251) n’est pas lisible.
          </p>
        ) : r.sources.length === 0 ? (
          <p className="text-sm text-muted">Aucune visite comptée depuis le {fmtDateFR(r.depuis)}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 font-medium text-right">Chaîne WhatsApp</th>
                  <th className="pb-2 font-medium text-right">Telegram</th>
                  <th className="pb-2 font-medium text-right">Inscriptions</th>
                </tr>
              </thead>
              <tbody>
                {r.sources.map((s) => (
                  <tr key={s.src} className="border-t border-border/60">
                    <td className="py-1.5 tabular text-ivory">{s.src}</td>
                    <td className="py-1.5 tabular text-right">{n(s.visitesChaine)}</td>
                    <td className="py-1.5 tabular text-right">{n(s.visitesTelegram)}</td>
                    <td className="py-1.5 tabular text-right">{n(s.inscriptions)}</td>
                  </tr>
                ))}
              </tbody>
              {total && (
                <tfoot>
                  <tr className="border-t border-border text-ivory">
                    <td className="pt-2 font-medium">Total</td>
                    <td className="pt-2 tabular text-right">{n(total.c)}</td>
                    <td className="pt-2 tabular text-right">{n(total.t)}</td>
                    <td className="pt-2 tabular text-right">{n(total.i)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
        <p className="text-xs text-faint">
          Une visite est un clic sur un lien de suivi (robots et aperçus de lien exclus), pas un abonnement :
          WhatsApp et Telegram ne transmettent pas qui s’abonne ensuite. Une inscription n’est comptée que pour un
          compte créé depuis <code className="tabular">/signup?src=…</code>. « inconnu » regroupe les liens sans source
          valide ; « debordement », les nouvelles sources au-delà de 300 dans la journée. Aucune donnée personnelle.
        </p>
      </PremiumPanel>
    </div>
  );
}
