import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SectionHeader } from '@/components/ui/premium';
import { libelleMois, lireReleve } from '@/lib/releve/affichage';

export const metadata = {
  title: 'Relevé mensuel',
};

export const dynamic = 'force-dynamic';

/**
 * Ancienne adresse d'un rapport par mois. Un relevé au nouveau format est
 * redirigé vers sa page (`/rapports/releve/[id]`) ; un ancien rapport (sans
 * `version` 2, produit sur le portefeuille simulé) n'a plus de page : il
 * affichait des « signaux du mois » et des « recommandations » que le produit
 * ne délivre plus.
 */
export default async function RapportParMoisPage(props: { params: Promise<{ month: string }> }) {
  const { month } = await props.params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) notFound();

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <p className="text-muted">Veuillez vous connecter pour accéder à ce relevé.</p>
      </div>
    );
  }

  const { data: ligne } = await supabase
    .from('monthly_reports')
    .select('id, month, report_json')
    .eq('user_id', user.id)
    .eq('month', month)
    .maybeSingle();
  if (!ligne) notFound();

  if (lireReleve(ligne.report_json)) redirect(`/rapports/releve/${ligne.id}`);

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <SectionHeader title={`Relevé de ${libelleMois(month)}`} subtitle="Ancien format (portefeuille simulé)." />
        <p className="mt-6 text-sm text-muted">
          Ce rapport a été produit avant la refonte du relevé mensuel : il n’a pas de version détaillée ni de PDF.
          Les relevés suivants portent sur votre portefeuille réel.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/premium/reports" className="text-accent-ink hover:underline">Retour à mes relevés</Link>
        </p>
      </div>
    </div>
  );
}
