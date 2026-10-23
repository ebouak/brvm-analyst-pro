import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, MetricCard, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';
import { loadMessagesContact, STATUT_CONTACT_LABEL, type StatutContact } from '@/lib/admin/contact';
import { LIVRAISON_LABEL, type Livraison } from '@/lib/contact/livraison';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Messages de contact — Administration' };

const nf = new Intl.NumberFormat('fr-FR');

const TON_LIVRAISON: Record<Livraison, string> = {
  envoye: 'text-faint',
  retarde: 'text-gold',
  remis: 'text-up',
  rejete: 'text-down font-medium',
  spam: 'text-down font-medium',
};

const TONE: Record<StatutContact, 'sapphire' | 'gold' | 'emerald' | 'neutral'> = {
  nouveau: 'gold',
  envoi: 'sapphire',
  repondu: 'emerald',
  clos: 'neutral',
  spam: 'neutral',
};

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function anciennete(jours: number): string {
  if (jours < 1 / 24) return 'à l’instant';
  if (jours < 1) return `${Math.round(jours * 24)} h ouvrées`;
  return `${jours.toFixed(1).replace('.', ',')} j ouvrés`;
}

export default async function Page() {
  await requirePermission('support.read');
  const { rows, erreur } = await loadMessagesContact();
  const attente = rows.filter((r) => r.statut === 'nouveau' || r.statut === 'envoi');
  const retard = attente.filter((r) => r.enRetard);
  const nonRemis = rows.filter((r) => r.livraison === 'rejete' || r.livraison === 'spam');

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        kicker="Administration"
        title="Messages de contact"
        subtitle="Messages de l'encart « Salut, on se parle ? ». L'accusé de réception promet une réponse sous 2 jours ouvrés ; une ligne passe en alerte après un jour."
      />
      <div className="gold-rule" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="À répondre" value={nf.format(attente.length)} accent="gold" />
        <MetricCard label="En retard (> 1 j ouvré)" value={nf.format(retard.length)} accent={retard.length ? 'gold' : 'neutral'} />
        <MetricCard label="Réponses non remises" value={nf.format(nonRemis.length)} accent={nonRemis.length ? 'gold' : 'neutral'} />
        <MetricCard label="Total conservé" value={nf.format(rows.length)} accent="sapphire" />
      </div>

      {erreur ? (
        <EmptyStatePremium title="Lecture impossible" hint={`La table contact_messages n'est pas lisible (${erreur}). Migration 0158 appliquée ?`} />
      ) : rows.length === 0 ? (
        <EmptyStatePremium title="Aucun message" hint="Les messages envoyés depuis l'encart de contact apparaîtront ici." />
      ) : (
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                <th className="px-4 py-3 font-medium">Visiteur</th>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="px-4 py-3 font-medium">Reçu</th>
                <th className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className={`border-b border-border/40 align-top last:border-0 ${m.enRetard ? 'bg-down/[0.06]' : ''}`}>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/contact/${m.id}`} className="font-medium text-ivory hover:text-accent">
                      {m.prenom || 'Sans prénom'}
                    </Link>
                    <div className="text-xs text-muted">
                      {m.canal === 'whatsapp' && <span className="mr-1 rounded bg-up/15 px-1.5 py-0.5 text-[10px] font-semibold text-up">WhatsApp</span>}
                      {m.destinataire}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/contact/${m.id}`} className="block max-w-md text-xs text-muted line-clamp-2 hover:text-ivory">
                      « {m.message} »
                    </Link>
                    {m.page && <div className="mt-1 text-[11px] text-faint">{m.page}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-muted tabular whitespace-nowrap">
                    {fmtDate(m.created_at)}
                    {(m.statut === 'nouveau' || m.statut === 'envoi') && (
                      <div className={`text-[11px] ${m.enRetard ? 'text-down font-medium' : 'text-faint'}`}>
                        {anciennete(m.joursOuvres)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatPill tone={TONE[m.statut]}>{STATUT_CONTACT_LABEL[m.statut]}</StatPill>
                    {m.statut === 'repondu' && (
                      <div className={`mt-1 text-[11px] ${m.livraison ? TON_LIVRAISON[m.livraison] : 'text-faint'}`}>
                        {m.livraison ? LIVRAISON_LABEL[m.livraison] : 'Livraison non suivie'}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PremiumPanel>
      )}
    </div>
  );
}
