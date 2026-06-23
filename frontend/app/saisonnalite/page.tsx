import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { getMonthlyReturns } from '@/lib/seasonality/server';
import SeasonalityMatrix from '@/components/seasonality/SeasonalityMatrix';
import { SectionHeader } from '@/components/ui/premium';

export const revalidate = 3600;
export const metadata = { title: 'Saisonnalité — WESTBOURSE' };

export default async function SaisonnalitePage({ searchParams }: { searchParams?: { code?: string } }) {
  const sb = createPublicClient();
  const { data: instr } = await sb
    .from('brvm_instruments').select('code, designation').eq('type', 'action').order('code');
  const instruments = (instr ?? []) as { code: string; designation: string | null }[];

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

      {/* Sélecteur de titre (form GET) */}
      <form className="flex items-center gap-2">
        <label className="text-xs text-faint">Titre :</label>
        <select name="code" defaultValue={code}
          className="bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-ivory">
          {instruments.map((i) => <option key={i.code} value={i.code}>{i.code} — {i.designation ?? ''}</option>)}
        </select>
        <button type="submit" className="text-xs px-3 py-1.5 rounded-lg bg-info/15 text-info">Afficher</button>
      </form>

      <div>
        <h2 className="font-display text-lg text-white">{code} <span className="text-sm text-muted">— {designation}</span></h2>
        <div className="mt-3">
          <SeasonalityMatrix returns={returns} />
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
