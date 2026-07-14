import Link from 'next/link';
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
        kicker="Outil · Analyse statistique"
        title="Saisonnalité"
        subtitle="Performance mensuelle moyenne d'une action sur plusieurs années — lecture statistique, à croiser avec tendance, liquidité et dividende."
      />

      {/* Sélecteur de titre (form GET). En essai, il est désactivé : l'aperçu
          gratuit porte sur un seul titre (le défaut), pour un seul mois. */}
      <form className="flex items-center gap-2">
        <label className="text-xs text-faint">Titre :</label>
        <select name="code" defaultValue={code} disabled={preview}
          className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-ivory disabled:opacity-50 disabled:cursor-not-allowed">
          {instruments.map((i) => <option key={i.code} value={i.code}>{i.code} — {i.designation ?? ''}</option>)}
        </select>
        {!preview && (
          <button type="submit" className="text-xs px-3 py-1.5 rounded-lg bg-info/15 text-info">Afficher</button>
        )}
        {preview && (
          <span className="text-[11px] text-faint">Choix du titre réservé au premium</span>
        )}
      </form>

      <div>
        <h2 className="font-display text-lg text-white">{code} <span className="text-sm text-muted">— {designation}</span></h2>
        <div className="mt-3">
          <SeasonalityMatrix returns={returns} preview={preview} />
        </div>
      </div>

      <p className="text-[11px] text-faint">
        Calcul sur l&apos;historique réel des cours (max 15 ans). Lecture statistique uniquement ;
        ne constitue pas un conseil en investissement.
      </p>
      <Link href="/outils" className="text-xs text-info hover:underline">← Outils</Link>
    </div>
  );
}
