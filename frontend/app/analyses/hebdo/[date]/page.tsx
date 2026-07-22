import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { SectionHeader, PremiumPanel } from '@/components/ui/premium';
import HebdoChart from '@/components/hebdo/HebdoChart';
import type { HebdoMetrics } from '@/lib/hebdo/types';

export const dynamic = 'force-dynamic';

interface Item { code: string; sens: string; raison: string; metrics: HebdoMetrics; narratif_md: string; ordre: number }

async function load(date: string) {
  const db = createPublicClient();
  const { data: ed } = await db.from('hebdo_editions').select('id, date_edition').eq('date_edition', date).maybeSingle();
  if (!ed) return null;
  const { data: items } = await db
    .from('hebdo_items')
    .select('code, sens, raison, metrics, narratif_md, ordre')
    .eq('edition_id', (ed as { id: string }).id)
    .order('ordre');
  return { date: (ed as { date_edition: string }).date_edition, items: (items ?? []) as Item[] };
}

export async function generateMetadata({ params }: { params: { date: string } }): Promise<Metadata> {
  const e = await load(params.date);
  if (!e) return { title: 'Édition introuvable' };
  const codes = e.items.map((i) => i.code).join(', ');
  return {
    title: `Analyse hebdo BRVM du ${e.date} — ${codes}`,
    description: `Analyse technique des valeurs en vue de la semaine : ${codes}. Cours, RSI, niveaux à surveiller.`,
  };
}

export default async function HebdoEditionPage({ params }: { params: { date: string } }) {
  const e = await load(params.date);
  if (!e) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <Link href="/analyses/hebdo" className="text-sm text-muted hover:text-white">← Toutes les éditions</Link>
      <SectionHeader
        kicker="Analyse hebdomadaire"
        title={`Les valeurs en vue — semaine du ${e.date}`}
        subtitle="Analyse technique sur données réelles de la BRVM : cours de clôture, RSI(14), niveaux de support et de résistance."
      />

      {e.items.map((it) => {
        const m = it.metrics;
        return (
          <PremiumPanel key={it.code} className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl text-white">
                {it.code}{' '}
                <span className={`text-sm ${it.sens === 'hausse' ? 'text-up' : 'text-down'}`}>
                  {m.variationHebdo != null ? `${m.variationHebdo >= 0 ? '+' : ''}${m.variationHebdo.toFixed(2)} %` : ''}
                </span>
              </h2>
              <span className="tabular text-sm text-muted">{m.dernier} FCFA</span>
            </div>
            <p className="text-xs text-faint">{it.raison}</p>

            <HebdoChart
              dates={m.dates} closes={m.closes} rsi={m.rsi}
              resistance={m.levels?.resistance ?? null} support={m.levels?.support ?? null}
            />

            <div className="space-y-3">
              {it.narratif_md.split(/^##\s+/m).filter(Boolean).map((bloc, i) => {
                const nl = bloc.indexOf('\n');
                const titre = nl >= 0 ? bloc.slice(0, nl).trim() : bloc;
                const texte = nl >= 0 ? bloc.slice(nl + 1).trim() : '';
                return (
                  <div key={i}>
                    <h3 className="text-sm font-semibold text-ivory">{titre}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{texte}</p>
                  </div>
                );
              })}
            </div>

            <a href={`/api/hebdo/${e.date}/image?code=${it.code}`} download
              className="inline-block rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-white">
              ⤓ Télécharger l’image
            </a>
          </PremiumPanel>
        );
      })}

      <PremiumPanel>
        <h2 className="text-sm font-semibold text-ivory">Lexique</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          <strong>RSI (Relative Strength Index)</strong> : mesure de 0 à 100 si un titre a été acheté
          ou vendu trop vite récemment. Au-dessus de 70 on parle de surachat, en dessous de 30 de
          survente. <strong>MACD</strong> : compare deux moyennes de prix de vitesses différentes pour
          détecter un changement de dynamique ; positif, il accompagne une tendance haussière.
          <strong> Support / résistance</strong> : bornes basse et haute des 20 dernières séances.
        </p>
        <p className="mt-3 text-[11px] leading-relaxed text-faint">
          Analyse technique produite automatiquement à partir des cours de clôture réels de la BRVM.
          Contenu fourni à titre informatif et pédagogique : il ne constitue pas un conseil en
          investissement.
        </p>
      </PremiumPanel>
    </div>
  );
}
