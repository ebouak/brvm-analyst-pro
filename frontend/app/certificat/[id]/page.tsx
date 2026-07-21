import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';

export const dynamic = 'force-dynamic';

const NIVEAU_LABEL: Record<string, string> = { debutant: 'Initiation à la BRVM', intermediaire: 'Fondamental', avance: 'Analyse technique', expert: 'Expert' };

async function load(id: string) {
  const db = createPublicClient();
  const { data } = await db.from('academy_certificates_public').select('id, niveau, display_name, issued_at').eq('id', id).maybeSingle();
  return data as { id: string; niveau: string; display_name: string; issued_at: string } | null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const c = await load(params.id);
  if (!c) return { title: 'Certificat introuvable' };
  const t = `${c.display_name} — Certificat ${NIVEAU_LABEL[c.niveau] ?? c.niveau} · WESTBOURSE Academy`;
  return { title: t, description: 'Certificat de formation BRVM délivré par WESTBOURSE Academy.' };
}

export default async function CertificatPublicPage({ params }: { params: { id: string } }) {
  const c = await load(params.id);
  if (!c) notFound();
  const date = new Date(c.issued_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl border border-gold/30 bg-surface p-10 text-center shadow-card">
        <p className="overline text-gold">WESTBOURSE Academy</p>
        <p className="mt-6 text-sm text-muted">Ce certificat atteste que</p>
        <p className="mt-2 font-display text-3xl text-white">{c.display_name}</p>
        <p className="mt-4 text-sm text-muted">a validé le niveau</p>
        <p className="mt-1 font-display text-xl text-gold">{NIVEAU_LABEL[c.niveau] ?? c.niveau}</p>
        <p className="mt-6 text-xs text-faint">Délivré le {date} · Réf. {c.id.slice(0, 8)}</p>
        <p className="mt-8 text-[11px] text-faint">Vérifiable sur westbourse.com/certificat/{c.id.slice(0, 8)}…</p>
      </div>
    </div>
  );
}
