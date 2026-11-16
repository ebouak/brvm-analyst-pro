import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import SousPageNav from '@/components/sousPage/SousPageNav';
import { SectionHeader } from '@/components/ui/premium';
import GraphiqueAvance from '@/components/graphique/GraphiqueAvance';

export const revalidate = 300;

type Params = { params: Promise<{ code: string }> };

async function lireValeur(code: string) {
  const { data } = await createPublicClient()
    .from('brvm_instruments')
    .select('code,designation,type')
    .eq('code', code)
    .eq('type', 'action')
    .maybeSingle();
  return data as { code: string; designation: string | null } | null;
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const code = (await props.params).code.toUpperCase();
  const v = await lireValeur(code);
  if (!v) return { title: 'Valeur introuvable' };
  return {
    title: `Graphique ${v.code}${v.designation ? ` · ${v.designation}` : ''}`,
    description: `Cours historiques de ${v.designation ?? v.code} à la BRVM : chandeliers, indicateurs, outils de dessin, comparaison en base 100 et export des cours.`,
  };
}

export default async function GraphiquePage(props: Params) {
  const code = (await props.params).code.toUpperCase();
  if (!/^[A-Z0-9]{2,12}$/.test(code)) notFound();
  const v = await lireValeur(code);
  if (!v) notFound();

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 md:px-6">
      <SousPageNav code={code} courant="Graphique avancé" />
      <SectionHeader
        title={`Graphique ${code}`}
        subtitle={`${v.designation ?? code} · cours de la BRVM. Information sur les cours passés, pas un conseil en investissement.`}
      />
      <GraphiqueAvance code={code} designation={v.designation} />
    </div>
  );
}
