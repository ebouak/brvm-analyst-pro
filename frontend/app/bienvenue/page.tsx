import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import BienvenuePicker, { type WelcomeAction } from '@/components/onboarding/BienvenuePicker';

// Moment d'accueil post-inscription : l'utilisateur choisit une action et voit
// notre analyse (note A–F + cours réel) instantanément — la valeur en 10 s.
// Données publiques (dernière séance) ; rendu dynamique côté serveur.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Bienvenue — WESTBOURSE', robots: { index: false } };

async function getActions(): Promise<WelcomeAction[]> {
  const supabase = createClient();
  const { data: lastRow } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastDate = (lastRow?.date_marche as string | undefined) ?? null;
  if (!lastDate) return [];

  const [{ data: instruments }, { data: quotes }, { data: signals }] = await Promise.all([
    supabase.from('brvm_instruments').select('code, designation, secteur').eq('type', 'action'),
    supabase.from('brvm_actions_daily').select('code, cours_jour, variation_pct').eq('date_marche', lastDate),
    supabase.from('signals_daily').select('code, score_total, confiance').eq('date_marche', lastDate),
  ]);

  const qByCode = new Map((quotes ?? []).map((q) => [q.code as string, q]));
  const sByCode = new Map((signals ?? []).map((s) => [s.code as string, s]));

  return (instruments ?? [])
    .map((i) => {
      const q = qByCode.get(i.code as string);
      const s = sByCode.get(i.code as string);
      return {
        code: i.code as string,
        designation: (i.designation as string | null) ?? (i.code as string),
        secteur: (i.secteur as string | null) ?? null,
        cours: (q?.cours_jour as number | null) ?? null,
        variation: (q?.variation_pct as number | null) ?? null,
        scoreTotal: (s?.score_total as number | null) ?? null,
        confiance: (s?.confiance as number | null) ?? null,
      };
    })
    .sort((a, b) => a.designation.localeCompare(b.designation));
}

export default async function BienvenuePage() {
  const actions = await getActions();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <p className="overline mb-3 text-gold-2">Bienvenue sur WESTBOURSE</p>
      <h1 className="mb-3 font-display text-3xl text-ivory md:text-4xl [letter-spacing:-0.03em]">
        Votre compte est prêt. Voyons une action ensemble.
      </h1>
      <p className="mb-8 max-w-[52ch] text-sm leading-relaxed text-muted">
        Choisissez une société qui vous intéresse : vous verrez immédiatement notre note et son dernier cours réel.
        C&apos;est exactement ce que WESTBOURSE fait pour les 48 sociétés de la BRVM.
      </p>
      <BienvenuePicker actions={actions} />
    </div>
  );
}
