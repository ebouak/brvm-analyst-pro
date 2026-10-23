import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, PremiumPanel, StatPill } from '@/components/ui/premium';
import { loadMessageContact, STATUT_CONTACT_LABEL } from '@/lib/admin/contact';
import { LIVRAISON_LABEL } from '@/lib/contact/livraison';
import ReponseForm from './ReponseForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Message de contact — Administration' };

function fmtDate(d: string): string {
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default async function Page({ params }: { params: { id: string } }) {
  const ctx = await requirePermission('support.read');
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const m = await loadMessageContact(params.id);
  if (!m) notFound();
  const peutRepondre = ctx.isSuperAdmin || ctx.permissions.has('support.reply');

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <Link href="/admin/contact" className="text-xs text-muted hover:text-ivory">
        ← Tous les messages
      </Link>
      <SectionHeader
        kicker="Message de contact"
        title={m.prenom || 'Visiteur sans prénom'}
        subtitle={`${m.canal === 'whatsapp' ? 'WhatsApp ' : ''}${m.destinataire} · reçu le ${fmtDate(m.created_at)}${m.page ? ` · depuis ${m.page}` : ''}`}
        actions={<StatPill tone={m.enRetard ? 'gold' : 'neutral'}>{STATUT_CONTACT_LABEL[m.statut]}</StatPill>}
      />

      <PremiumPanel>
        <div className="rounded-[calc(var(--radius-panel,16px)-6px)] bg-surface p-5">
          <div className="text-[11px] uppercase tracking-wider text-faint">Message reçu</div>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-ivory">{m.message}</p>
        </div>
      </PremiumPanel>

      {m.statut === 'repondu' ? (
        <PremiumPanel>
          <div className="rounded-[calc(var(--radius-panel,16px)-6px)] bg-surface p-5">
            <div className="text-[11px] uppercase tracking-wider text-faint">
              Réponse envoyée{m.repondu_at ? ` le ${fmtDate(m.repondu_at)}` : ''}{' '}
              {m.canal === 'whatsapp' ? 'sur WhatsApp, depuis le numéro WESTBOURSE' : 'depuis support@westbourse.com'}
            </div>
            <p className={`mt-2 text-sm ${m.livraison === 'rejete' || m.livraison === 'spam' ? 'text-down font-medium' : m.livraison === 'remis' ? 'text-up' : 'text-muted'}`}>
              Livraison : {m.livraison ? LIVRAISON_LABEL[m.livraison] : 'non suivie'}
              {m.livraison_at ? ` (${fmtDate(m.livraison_at)})` : ''}
              {m.livraison_detail ? ` — ${m.livraison_detail}` : ''}
            </p>
            {(m.livraison === 'rejete' || m.livraison === 'spam') && (
              <p className="mt-1 text-xs text-down">
                La réponse n&apos;est pas arrivée : vérifiez l&apos;adresse, ou joignez cette personne par un autre moyen.
              </p>
            )}
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">{m.reponse}</p>
            <p className="mt-4 text-xs text-faint">
              {m.canal === 'whatsapp'
                ? 'Une relance du visiteur rouvre une fiche ici même.'
                : 'Une relance du visiteur arrive dans la boîte de support (routage Cloudflare vers Gmail).'}
            </p>
          </div>
        </PremiumPanel>
      ) : (
        <ReponseForm
          id={m.id}
          email={m.destinataire}
          canal={m.canal}
          statut={m.statut}
          brouillonInitial={m.brouillon ?? ''}
          peutRepondre={peutRepondre}
        />
      )}
    </div>
  );
}
