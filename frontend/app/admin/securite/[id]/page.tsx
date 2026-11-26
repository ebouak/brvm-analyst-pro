import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';
import { chargerFicheSecurite, type FicheSecurite } from '@/lib/securite/lectureAdmin';
import { appareilDe } from '@/lib/securite/appareil';
import { nomPays } from '@/lib/crm/geo';
import { ActionsCompte } from '../ActionsCompte';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fiche sécurité — Administration' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
}

const LIBELLE_DECISION: Record<string, string> = {
  legitime: 'Marqué légitime', deconnexion: 'Appareils déconnectés', avertissement: 'Avertissement envoyé',
  suspension: 'Premium suspendu', levee: 'Suspension levée',
};
const LIBELLE_FERMETURE: Record<string, string> = {
  plafond: 'plafond', admin: 'administrateur', utilisateur: 'utilisateur', disparue: 'déconnexion ou expiration',
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
  await requirePermission('users.suspend');
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();

  let f: FicheSecurite | null = null;
  let erreur: string | null = null;
  try {
    f = await chargerFicheSecurite(id);
  } catch (e) {
    erreur = e instanceof Error ? e.message : String(e);
  }
  if (!f) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <SectionHeader title="Fiche sécurité" />
        <EmptyStatePremium title="Lecture impossible" hint={erreur ?? 'Compte introuvable.'} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <Link href="/admin/securite" className="text-xs text-muted hover:text-ivory">← Sécurité des comptes</Link>
      <SectionHeader
        title={f.email ?? f.userId}
        subtitle={`${f.premium ? 'Premium' : 'Gratuit'} · inscrit le ${fmt(f.creeLe)}${f.suspendu ? ` · Premium suspendu ${f.suspendu === 'indefinie' ? 'jusqu’à levée' : `jusqu’au ${fmt(f.suspendu)}`}` : ''}`}
      />
      <div className="flex gap-3 text-xs">
        <Link href={`/admin/users/${f.userId}`} className="text-accent hover:underline">Fiche utilisateur</Link>
      </div>

      <PremiumPanel>
        <h2 className="mb-3 text-xs font-medium text-faint">Décider</h2>
        <ActionsCompte userId={f.userId} suspendu={f.suspendu !== null} premium={f.premium} />
      </PremiumPanel>

      <PremiumPanel>
        <h2 className="text-xs font-medium text-faint">Appareils connectés maintenant ({f.appareils.length})</h2>
        {f.appareils.length === 0 ? (
          <p className="mt-2 text-xs text-faint">Aucune session ouverte.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border/40 text-sm">
            {f.appareils.map((a) => (
              <li key={a.cle} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-ivory">{a.libelles.join(', ')}</span>
                <span className="text-xs text-muted tabular">{a.reseau ?? 'réseau inconnu'} · {fmt(a.activite)} · {a.sessionIds.length} session(s)</span>
              </li>
            ))}
          </ul>
        )}
      </PremiumPanel>

      <PremiumPanel>
        <h2 className="text-xs font-medium text-faint">Signaux récents</h2>
        {f.signaux.length === 0 ? (
          <p className="mt-2 text-xs text-faint">Aucun signal sur les derniers calculs.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs">
            {f.signaux.map((s) => (
              <li key={s.jour}>
                <StatPill tone={s.niveau === 'suspect' ? 'gold' : 'neutral'}>{s.niveau === 'suspect' ? 'Suspect' : 'À surveiller'}</StatPill>{' '}
                <span className="text-faint">{new Date(`${s.jour}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}</span>
                <ul className="mt-1 text-muted">
                  {s.raisons.map((r) => (
                    <li key={r.code}>{r.libelle} : <span className="tabular text-ivory">{r.valeur}</span> <span className="text-faint">/ {r.seuil}</span></li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </PremiumPanel>

      <PremiumPanel className="overflow-x-auto p-0">
        <h2 className="px-4 pt-4 text-xs font-medium text-faint">Sessions observées (30 jours)</h2>
        {f.historique.length === 0 ? (
          <p className="px-4 pb-4 pt-2 text-xs text-faint">Aucune session observée.</p>
        ) : (
          <table className="mt-2 w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-faint">
                <th className="px-4 py-2 font-medium">Appareil</th>
                <th className="px-4 py-2 font-medium">Réseau · pays</th>
                <th className="px-4 py-2 font-medium">Première vue</th>
                <th className="px-4 py-2 font-medium">Dernière vue</th>
                <th className="px-4 py-2 font-medium">Fermée</th>
              </tr>
            </thead>
            <tbody>
              {f.historique.map((h) => (
                <tr key={h.session_id} className="border-b border-border/40 last:border-0 text-muted">
                  <td className="px-4 py-2 text-ivory">{appareilDe(h.user_agent).libelle}</td>
                  <td className="px-4 py-2 tabular">{h.reseau ?? '—'}{h.pays ? ` · ${nomPays(h.pays)}` : ''}</td>
                  <td className="px-4 py-2 tabular whitespace-nowrap">{fmt(h.premiere_vue)}</td>
                  <td className="px-4 py-2 tabular whitespace-nowrap">{fmt(h.derniere_vue)}</td>
                  <td className="px-4 py-2">{h.fermee_at ? `${fmt(h.fermee_at)} (${LIBELLE_FERMETURE[h.fermee_par ?? ''] ?? h.fermee_par})` : 'ouverte'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PremiumPanel>

      <div className="grid gap-6 md:grid-cols-2">
        <PremiumPanel>
          <h2 className="text-xs font-medium text-faint">Connexions (30 jours)</h2>
          {f.connexions.length === 0 ? (
            <p className="mt-2 text-xs text-faint">Aucune connexion journalisée (le journal démarre avec la migration 0273).</p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {f.connexions.map((c, i) => (
                <li key={`${c.created_at}-${i}`} className="flex justify-between gap-2">
                  <span className="tabular">{fmt(c.created_at)}</span>
                  <span>{c.pays ? nomPays(c.pays) : 'pays inconnu'}</span>
                </li>
              ))}
            </ul>
          )}
        </PremiumPanel>

        <PremiumPanel>
          <h2 className="text-xs font-medium text-faint">Décisions</h2>
          {f.decisions.length === 0 ? (
            <p className="mt-2 text-xs text-faint">Aucune décision.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-xs">
              {f.decisions.map((d) => (
                <li key={d.id}>
                  <span className="text-ivory">{LIBELLE_DECISION[d.type] ?? d.type}</span>{' '}
                  <span className="text-faint">{fmt(d.created_at)}{d.jusqu_au ? ` → ${fmt(d.jusqu_au)}` : ''}</span>
                  <div className="text-muted">« {d.motif} »</div>
                </li>
              ))}
            </ul>
          )}
        </PremiumPanel>
      </div>

      {f.fermetures.length > 0 && (
        <PremiumPanel>
          <h2 className="text-xs font-medium text-faint">Sessions fermées</h2>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {f.fermetures.map((x) => (
              <li key={x.id} className="flex flex-wrap justify-between gap-2">
                <span>{appareilDe(x.userAgent).libelle} · {LIBELLE_FERMETURE[x.motif] ?? x.motif}{x.simulee ? ' (simulée)' : ''}</span>
                <span className="tabular">{fmt(x.created_at)}</span>
              </li>
            ))}
          </ul>
        </PremiumPanel>
      )}
    </div>
  );
}
