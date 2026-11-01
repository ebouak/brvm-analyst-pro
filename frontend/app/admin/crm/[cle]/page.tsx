// frontend/app/admin/crm/[cle]/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requirePermission, can } from '@/lib/server/rbac';
import { SectionHeader } from '@/components/ui/premium';
import { chargerDossier } from '@/lib/crm/charger';
import { scorer } from '@/lib/crm/score';
import { etatPaiement } from '@/lib/crm/paiement';
import { vueDe } from '@/lib/crm/vues';
import { listerResponsables } from '@/lib/crm/responsables';
import { chargerReglages } from '@/lib/crm/reglagesServeur';
import { preparerFiche } from '../preparerFiche';
import FicheProspect from '../FicheProspect';

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
  const etat = etatPaiement(d, maintenant);
  const reglages = await chargerReglages();
  const { vue } = vueDe(d, maintenant, reglages);
  const score = scorer(d, maintenant);
  const responsables = await listerResponsables().catch(() => []);
  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <Link href="/admin/crm" className="text-sm text-muted hover:text-ivory">← Retour au CRM</Link>
      <SectionHeader kicker="CRM" title={d.nom ?? d.emailNorm} />
      <FicheProspect d={d} etat={etat} vue={vue} score={score} canWrite={can(ctx, 'crm.write')} responsables={responsables} maintenant={maintenant} reglages={reglages} {...preparerFiche(d, score, maintenant)} />
    </div>
  );
}
