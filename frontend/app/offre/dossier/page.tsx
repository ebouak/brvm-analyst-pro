// frontend/app/offre/dossier/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { etatJeton } from '@/lib/crm/jetonBonus';
import Choix from './Choix';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Votre dossier offert — WESTBOURSE', robots: { index: false, follow: false } };

const WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');

function PageMessage({ titre, texte }: { titre: string; texte: string }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <p className="overline mb-3 text-gold-2">Dossier offert</p>
      <h1 className="mb-4 font-display text-3xl text-ivory [letter-spacing:-0.03em]">{titre}</h1>
      <p className="mb-8 text-sm text-muted">{texte}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/signup" className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-bg">Créer mon compte gratuit</Link>
        {WHATSAPP && <a href={`https://wa.me/${WHATSAPP}`} className="rounded-full border border-border px-5 py-2.5 text-sm text-ivory">Écrire sur WhatsApp</a>}
      </div>
    </main>
  );
}

export default async function Page({ searchParams }: { searchParams: { t?: string } }) {
  const jeton = /^[a-f0-9]{48}$/.test(searchParams.t ?? '') ? (searchParams.t as string) : null;
  const sb = getServiceClient();
  const res = jeton
    ? await sb.from('crm_actions').select('created_at, bonus_at, user_id').eq('jeton_bonus', jeton).maybeSingle()
    : { data: null, error: null };
  // Échec fermé : une erreur de lecture n'est pas un lien inconnu.
  if (res.error) {
    return <PageMessage titre="Service momentanément indisponible" texte="Réessayez dans un instant : votre lien reste valable." />;
  }
  const ligne = res.data;
  const etat = etatJeton(ligne ?? null, new Date());

  if (etat !== 'valide' || !jeton) {
    const titre = etat === 'utilise' ? 'Votre dossier offert a déjà été choisi' : etat === 'expire' ? 'Ce lien a expiré' : 'Lien introuvable';
    return <PageMessage titre={titre} texte="Créez votre compte gratuit pour suivre toutes les sociétés de la BRVM, ou écrivez-nous : nous vous répondons personnellement." />;
  }

  const userId = (ligne as { user_id: string | null } | null)?.user_id ?? null;
  const [{ data: instruments }, positions] = await Promise.all([
    sb.from('brvm_instruments').select('code, designation, secteur').eq('type', 'action').order('designation'),
    userId ? sb.from('portfolios_positions').select('code').eq('user_id', userId).gt('quantite', 0).then((r) => r.data ?? []) : Promise.resolve([] as { code: string }[]),
  ]);
  const detenus = new Set((positions as { code: string }[]).map((p) => p.code));
  const valeurs = ((instruments ?? []) as { code: string; designation: string | null; secteur: string | null }[])
    .map((i) => ({ code: i.code, designation: i.designation ?? i.code, secteur: i.secteur, detenu: detenus.has(i.code) }))
    .sort((a, b) => Number(b.detenu) - Number(a.detenu) || a.designation.localeCompare(b.designation));

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <p className="overline mb-3 text-gold-2">Offert par WESTBOURSE</p>
      <h1 className="mb-3 font-display text-3xl text-ivory md:text-4xl [letter-spacing:-0.03em]">Choisissez votre dossier valeur</h1>
      <p className="mb-8 max-w-[56ch] text-sm leading-relaxed text-muted">Une société cotée, son dossier complet en PDF, tel que nous le produisons chaque semaine. Un seul choix : prenez celle qui compte pour vous.</p>
      <Choix jeton={jeton} valeurs={valeurs} />
    </main>
  );
}
