import type { Metadata } from 'next';
import PublicShell from '@/components/public/PublicShell';
import SgiComparator from '@/components/landing/SgiComparator';

export const dynamic = 'force-static';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://frontend-zeta-ten-22.vercel.app';

export const metadata: Metadata = {
  title: 'Comparateur des SGI BRVM — choisir son courtier UEMOA | BRVM Analyst Pro',
  description:
    "Annuaire et comparateur des SGI agréées à la BRVM, classées par pays UEMOA : Côte d'Ivoire, Sénégal, Burkina Faso, Mali, Bénin, Togo, Niger. Type, groupe, dépôt minimum indicatif et critères pour choisir votre courtier.",
  keywords: [
    'SGI BRVM',
    'comparateur SGI',
    'liste SGI UEMOA',
    'courtier BRVM',
    'ouvrir compte titres BRVM',
    'dépôt minimum SGI',
    "SGI Côte d'Ivoire",
    'SGI Sénégal',
  ],
  alternates: { canonical: `${SITE_URL}/comparateur-sgi` },
  openGraph: {
    type: 'website',
    title: 'Comparateur des SGI BRVM — choisir son courtier UEMOA',
    description:
      'Toutes les SGI de la BRVM par pays. Comparez type, groupe et dépôt minimum indicatif pour choisir votre courtier UEMOA.',
    url: `${SITE_URL}/comparateur-sgi`,
  },
};

export default function ComparateurSgiPage() {
  return (
    <PublicShell>
      <SgiComparator className="scroll-mt-24" />
    </PublicShell>
  );
}
