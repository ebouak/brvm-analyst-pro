import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createPublicClient } from '@/lib/supabase/public';
import { getMonthlyReturns } from '@/lib/seasonality/server';
import SeasonalityMatrix from '@/components/seasonality/SeasonalityMatrix';
import { SectionHeader } from '@/components/ui/premium';
import { canAccess } from '@/lib/server/featureAccess';

// Garde par utilisateur (essai gratuit limité vs premium complet) : dynamique.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Saisonnalité' };

export default async function SaisonnalitePage({ searchParams }: { searchParams?: { code?: string } }) {
  // Niveau requis LU EN BASE. En cas de refus on n'affiche pas une porte fermee :
  // on bascule en APERCU (mois en cours seulement) — l'essai limite demande.
  const gate = await canAccess('saisonnalite');
  const preview = !gate.allowed;

  const sb = createPublicClient();
  // Actions ET obligations : l'essai gratuit doit pouvoir porter sur l'un ou l'autre.
  const { data: instr } = await sb
    .from('brvm_instruments').select('code, designation, type')
    .in('type', ['action', 'obligation']).order('code');
  const instruments = (instr ?? []) as { code: string; designation: string | null; type: string }[];

  const code = (searchParams?.code ?? instruments[0]?.code ?? 'PALC').toUpperCase();
  const returns = await getMonthlyReturns(code).catch(() => []);
  const designation = instruments.find((i) => i.code === code)?.designation ?? code;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader
        title="Saisonnalité"
        subtitle="Performance mensuelle moyenne d'une action sur plusieurs années · lecture statistique, à croiser avec tendance, liquidité et dividende."
      />

      {/* Sélecteur de titre (form GET). En essai, il est désactivé : l'aperçu
          gratuit porte sur un seul titre (le défaut), pour un seul mois. */}
      <form className="flex min-w-0 flex-wrap items-center gap-2">
        <label htmlFor="saison-titre" className="text-xs text-faint">Titre :</label>
        <select id="saison-titre" name="code" defaultValue={code} disabled={preview}
          className="min-w-0 max-w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-ivory disabled:opacity-50 disabled:cursor-not-allowed">
          {instruments.map((i) => <option key={i.code} value={i.code}>{i.code} — {i.designation ?? ''}</option>)}
        </select>
        {!preview && (
          <button type="submit" className="text-xs px-3 py-1.5 rounded-lg bg-info/15 text-accent-ink">Afficher</button>
        )}
        {preview && (
          <span className="text-xs text-faint">Choix du titre réservé au premium</span>
        )}
      </form>

      <div>
        <h2 className="font-display text-lg text-ivory"><span className="font-mono font-medium">{code}</span> <span className="text-sm text-muted">— {designation}</span></h2>
        <div className="mt-3">
          <SeasonalityMatrix returns={returns} preview={preview} />
        </div>
      </div>

      <p className="text-xs text-faint">
        Calcul sur l&apos;historique réel des cours (max 15 ans). Lecture statistique uniquement ;
        ne constitue pas un conseil en investissement.
      </p>
      <Link href="/outils" className="inline-flex items-center gap-1 text-xs text-accent-ink hover:underline"><ArrowLeft size={12} aria-hidden />Outils</Link>
    </div>
  );
}
