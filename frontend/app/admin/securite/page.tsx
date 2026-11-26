import Link from 'next/link';
import { can, requirePermission } from '@/lib/server/rbac';
import { SectionHeader, MetricCard, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';
import { chargerTableauSecurite, type TableauSecurite } from '@/lib/securite/lectureAdmin';
import { appareilDe } from '@/lib/securite/appareil';
import { SEUILS } from '@/lib/securite/signaux';
import { ReglagePlafond } from './ReglagePlafond';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sécurité des comptes — Administration' };

const nf = new Intl.NumberFormat('fr-FR');

function fmt(d: string): string {
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const LIBELLE_DECISION: Record<string, string> = {
  legitime: 'Légitime', deconnexion: 'Déconnecté', avertissement: 'Averti', suspension: 'Suspendu', levee: 'Levée',
};

const LIBELLE_NOTIFIE: Record<string, string> = {
  envoye: 'e-mail envoyé', echec: 'e-mail en échec', incertain: 'e-mail non confirmé', non_requis: 'session dormante, sans e-mail',
};

/**
 * Console de sécurité des comptes. Aide à la décision : chaque signal porte son
 * chiffre et son seuil ; rien n'est sanctionné sans une décision humaine.
 */
export default async function Page() {
  const ctx = await requirePermission('users.suspend');
  let t: TableauSecurite | null = null;
  let erreur: string | null = null;
  try {
    t = await chargerTableauSecurite();
  } catch (e) {
    erreur = e instanceof Error ? e.message : String(e);
  }

  if (!t) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <SectionHeader title="Sécurité des comptes" subtitle="Partage de compte, abus et fraude." />
        <EmptyStatePremium title="Lecture impossible" hint={`Les tables de sécurité ne sont pas lisibles (${erreur}). Migration 0273 appliquée ?`} />
      </div>
    );
  }

  const reelles = t.fermetures.filter((f) => !f.simulee && f.motif === 'plafond');
  const suspects = t.signaux.filter((s) => s.niveau === 'suspect').length;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        title="Sécurité des comptes"
        subtitle="Plafond d'appareils Premium, signaux de partage et d'abus, décisions. Un signal n'est pas une preuve : les adresses mobiles changent souvent et un bureau ou un cybercafé partage la même."
      />
      <div className="gold-rule" />

      <PremiumPanel>
        <ReglagePlafond mode={t.reglages.mode} plafond={t.reglages.plafond} peutModifier={can(ctx, 'settings.write')} />
      </PremiumPanel>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Comptes suspects" value={nf.format(suspects)} accent={suspects ? 'gold' : 'neutral'} />
        <MetricCard label="À surveiller" value={nf.format(t.signaux.length - suspects)} accent="neutral" />
        <MetricCard label="Sessions fermées par le plafond (7 j)" value={nf.format(reelles.length)} accent="sapphire" />
        <MetricCard label="Suspensions du Premium en cours" value={nf.format(t.suspensionsActives)} accent={t.suspensionsActives ? 'gold' : 'neutral'} />
      </div>

      <p className="text-xs text-faint">
        Signaux du {t.jourSignaux ? new Date(`${t.jourSignaux}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' }) : '—'}
        {' · '}dernier rapport Telegram :{' '}
        {t.dernierRapport
          ? `${t.dernierRapport.statut === 'envoye' ? 'envoyé' : t.dernierRapport.statut === 'echec' ? 'EN ÉCHEC' : 'en cours'} (${t.dernierRapport.jour})`
          : 'aucun'}
      </p>

      <div>
        <h2 className="mb-2 text-xs font-medium text-faint">Comptes à examiner</h2>
        {t.signaux.length === 0 ? (
          <EmptyStatePremium title="Aucun compte à examiner" hint="Les signaux sont recalculés chaque matin ; un compte n'apparaît ici que s'il franchit un seuil." />
        ) : (
          <PremiumPanel className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-faint">
                  <th className="px-4 py-3 font-medium">Compte</th>
                  <th className="px-4 py-3 font-medium">Niveau</th>
                  <th className="px-4 py-3 font-medium">Raisons (valeur / seuil)</th>
                  <th className="px-4 py-3 font-medium">Dernière décision</th>
                </tr>
              </thead>
              <tbody>
                {t.signaux.map((s) => (
                  <tr key={s.userId} className="border-b border-border/40 align-top last:border-0">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/securite/${s.userId}`} className="font-medium text-ivory hover:text-accent">
                        {s.email ?? s.userId.slice(0, 8)}
                      </Link>
                      <div className="text-xs text-faint">{s.premium ? 'Premium' : 'Gratuit'}{s.suspendu ? ' · suspendu' : ''}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatPill tone={s.niveau === 'suspect' ? 'gold' : 'neutral'}>{s.niveau === 'suspect' ? 'Suspect' : 'À surveiller'}</StatPill>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">
                      <ul className="space-y-0.5">
                        {s.raisons.map((r) => (
                          <li key={r.code}>
                            {r.libelle} : <span className="tabular text-ivory">{r.valeur}</span> <span className="text-faint">/ {r.seuil}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">
                      {s.derniereDecision ? `${LIBELLE_DECISION[s.derniereDecision.type] ?? s.derniereDecision.type}, ${fmt(s.derniereDecision.created_at)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PremiumPanel>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-xs font-medium text-faint">Sessions fermées (7 derniers jours)</h2>
        {t.fermetures.length === 0 ? (
          <EmptyStatePremium title="Aucune fermeture" hint="Les fermetures par le plafond, par un administrateur ou par l'utilisateur lui-même apparaîtront ici." />
        ) : (
          <PremiumPanel className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-faint">
                  <th className="px-4 py-3 font-medium">Compte</th>
                  <th className="px-4 py-3 font-medium">Appareil</th>
                  <th className="px-4 py-3 font-medium">Motif</th>
                  <th className="px-4 py-3 font-medium">Fermée le</th>
                </tr>
              </thead>
              <tbody>
                {t.fermetures.map((f) => (
                  <tr key={f.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/securite/${f.userId}`} className="text-ivory hover:text-accent">{f.email ?? f.userId.slice(0, 8)}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">
                      {appareilDe(f.userAgent).libelle}
                      {f.derniereActivite && <div className="text-faint">utilisé le {fmt(f.derniereActivite)}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">
                      {f.motif === 'plafond' ? 'Plafond' : f.motif === 'admin' ? 'Administrateur' : 'Utilisateur'}
                      {f.simulee && <span className="ml-1 text-gold">(simulée)</span>}
                      {f.notifie && <div className="text-faint">{LIBELLE_NOTIFIE[f.notifie] ?? f.notifie}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted tabular whitespace-nowrap">{fmt(f.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PremiumPanel>
        )}
      </div>

      <PremiumPanel>
        <h2 className="text-xs font-medium text-faint">Seuils appliqués</h2>
        <ul className="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-2">
          <li>Sessions encore utilisées fermées par le plafond (30 j) : à surveiller dès {SEUILS.siegesSurveiller}, suspect dès {SEUILS.siegesSuspect}</li>
          <li>Appareils distincts (30 j) : à surveiller dès {SEUILS.appareilsSurveiller}, suspect dès {SEUILS.appareilsSuspect}</li>
          <li>Pays de connexion distincts (30 j) : à surveiller dès {SEUILS.paysSurveiller}</li>
          <li>Changement de pays en moins de {SEUILS.paysRapprochesHeures} h : à surveiller</li>
          <li>Questions à l’IA : à surveiller au-delà de {SEUILS.usageIaRatio} fois la médiane Premium (et au moins {SEUILS.usageIaMinimum})</li>
          <li>Inscriptions même réseau et même navigateur (30 j) : à surveiller dès {SEUILS.groupeSurveiller} comptes, suspect dès {SEUILS.groupeSuspect}</li>
          <li>{SEUILS.cumulSuspect} raisons « à surveiller » cumulées font un compte suspect</li>
          <li>Comptes d’administration et de test : jamais évalués ni plafonnés</li>
        </ul>
      </PremiumPanel>
    </div>
  );
}
