import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import CertificatPublicCarte from '@/components/academy/CertificatPublicCarte';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

const NIVEAU_LABEL: Record<string, string> = {
  debutant: 'Niveau 1 — Initiation à la BRVM',
  intermediaire: 'Niveau 2 — Analyse Fondamentale',
  avance: 'Niveau 3 — Analyse Technique',
  expert: 'Niveau 4 — Expert : régulation et marché primaire',
};

const COMPETENCES_PAR_NIVEAU: Record<string, readonly string[]> = {
  debutant: [
    'Architecture de la BRVM, rôle de l’AMF-UMOA, des SGI et du DC/BR',
    'Passage d’ordres, frais de courtage et construction d’un premier budget',
    'Mécanique des dividendes, fiscalité IRVM UEMOA et DPS',
    'Gestion du risque de concentration et lecture du Bulletin officiel',
  ],
  intermediaire: [
    'Lecture des états financiers SYSCOHADA révisés et qualité des marges',
    'Analyse bancaire UEMOA (PNB, coefficient d’exploitation, coût du risque)',
    'Valorisation par multiples (PER, P/B, ROE) et détection des value traps',
    'Obligations d’État et privées, OPCVM et construction de portefeuille',
  ],
  avance: [
    'Concentration de la liquidité BRVM et règle des séances sans échange',
    'Lecture des chandeliers japonais et figures mesurées sur la cote',
    'Moyennes mobiles, RSI et MACD 12/26/9 sur données historiques réelles',
    'Gestion de taille de position, niveaux de sortie et discipline de risque',
  ],
  expert: [
    'Réglementation AMF-UMOA, visa, gouvernance et obligations d’information',
    'Introductions en bourse (IPO) et augmentations de capital',
    'Fiscalité comparée et structuration de portefeuille long terme',
    'Évaluation critique des opérations sur titres sur le marché primaire',
  ],
};

async function load(id: string) {
  const db = createPublicClient();
  const { data } = await db
    .from('academy_certificates_public')
    .select('id, niveau, display_name, issued_at')
    .eq('id', id)
    .maybeSingle();
  return data as { id: string; niveau: string; display_name: string; issued_at: string } | null;
}

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const params = await props.params;
  const c = await load(params.id);
  if (!c) return { title: 'Certificat introuvable' };
  const t = `${c.display_name} — ${NIVEAU_LABEL[c.niveau] ?? c.niveau} · WESTBOURSE Academy`;
  return { title: t, description: 'Certificat de formation BRVM vérifiable délivré par WESTBOURSE Academy.' };
}

export default async function CertificatPublicPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const c = await load(params.id);
  if (!c) notFound();
  const date = new Date(c.issued_at).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <CertificatPublicCarte
        id={c.id}
        displayName={c.display_name}
        niveauLabel={NIVEAU_LABEL[c.niveau] ?? c.niveau}
        niveauCode={c.niveau}
        issuedDate={date}
        competences={COMPETENCES_PAR_NIVEAU[c.niveau] ?? []}
        verifyUrl={`${SITE_URL}/certificat/${c.id}`}
      />
    </div>
  );
}
