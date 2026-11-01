// frontend/app/admin/crm/[cle]/page.tsx
import { notFound } from 'next/navigation';
import { requirePermission, can } from '@/lib/server/rbac';
import { SectionHeader } from '@/components/ui/premium';
import { chargerDossier } from '@/lib/crm/charger';
import { chronologie } from '@/lib/crm/identite';
import { scorer, fmtJour } from '@/lib/crm/score';
import { choisirGabarit, composerRelance } from '@/lib/crm/gabarits';
import RelanceForm from './RelanceForm';
import RelanceWhatsapp from './RelanceWhatsapp';
import { texteWhatsappInitial } from '@/lib/crm/whatsappRelance';
import NoteForm from './NoteForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fiche CRM — Administration' };

export default async function Page({ params }: { params: { cle: string } }) {
  const ctx = await requirePermission('crm.read');
  let cle: string;
  try {
    cle = decodeURIComponent(params.cle);
  } catch {
    notFound();
  }
  const d = await chargerDossier(cle);
  if (!d) notFound();
  const maintenant = new Date();
  const s = scorer(d, maintenant);
  const templateId = choisirGabarit(d, s);
  const { sujet, corps } = composerRelance(templateId, d);
  const derniere = [...d.actions].filter((a) => a.type === 'relance' && (a.statut === 'envoye' || a.statut === 'prepare')).sort((a, b) => b.date.localeCompare(a.date))[0];
  const recente = derniere && maintenant.getTime() - Date.parse(derniere.date) < 14 * 86_400_000 ? fmtJour(derniere.date) : null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <SectionHeader kicker="CRM" title={d.nom ?? d.emailNorm} />
      <section className="space-y-1 text-sm">
        <p className="text-muted">{d.emailNorm} · {d.userId ? (d.premium ? 'Premium' : 'compte gratuit') : 'prospect sans compte'}{d.inscritLe ? ` · inscrit le ${fmtJour(d.inscritLe)}` : ''}</p>
        <p className="tabular text-ivory">Score {s.score} · {s.niveau}</p>
        <ul className="list-disc pl-5 text-muted">{s.raisons.map((r) => <li key={r.code}>{r.texte} (+{r.points})</li>)}</ul>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-ivory">Chronologie</h2>
        <ul className="space-y-1 text-sm">{chronologie(d).map((e, i) => <li key={i} className="text-muted"><span className="tabular text-faint">{fmtJour(e.date)}</span> · {e.libelle}</li>)}</ul>
      </section>
      {can(ctx, 'crm.write') && (
        <>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-ivory">Relance par e-mail</h2>
            {d.premium || d.admin ? (
              <p className="text-sm text-muted">Personne Premium ou administratrice : pas de relance commerciale.</p>
            ) : (
              <RelanceForm cle={d.cle} templateId={templateId} sujetInitial={sujet} corpsInitial={corps} relanceRecente={recente} oppose={d.oppose} />
            )}
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-ivory">Relance par WhatsApp</h2>
            {d.premium || d.admin || d.oppose ? (
              <p className="text-sm text-muted">Relance commerciale désactivée pour cette personne.</p>
            ) : d.whatsapp.numero && d.whatsapp.recontact && d.whatsapp.source ? (
              <RelanceWhatsapp cle={d.cle} templateId={templateId} texteInitial={texteWhatsappInitial(d.nom?.trim().split(/\s+/)[0] || null)} numero={d.whatsapp.numero} source={d.whatsapp.source} />
            ) : d.whatsapp.lieSansNumero ? (
              <p className="text-sm text-muted">WhatsApp lié sans numéro visible : joignable en répondant dans la console de contact WhatsApp.</p>
            ) : d.whatsapp.numero ? (
              <p className="text-sm text-muted">Numéro connu, mais pas de consentement au recontact : pas de relance WhatsApp.</p>
            ) : (
              <p className="text-sm text-muted">Aucun numéro WhatsApp connu.</p>
            )}
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-ivory">Notes internes</h2>
            <NoteForm cle={d.cle} />
          </section>
        </>
      )}
    </div>
  );
}
