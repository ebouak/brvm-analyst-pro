import type { Metadata } from 'next';
import FilAriane from '@/components/nav/FilAriane';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { fmtDateCourte, fmtNumber } from '@/lib/format';
import { createPublicClient } from '@/lib/supabase/public';
import HebdoChart from '@/components/hebdo/HebdoChart';
import CopyPostButton from '@/components/hebdo/CopyPostButton';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { LigneSource } from '@/components/marche/LigneSource';
import type { HebdoMetrics } from '@/lib/hebdo/types';

// ISR (2026-11-18, quota CPU Vercel) : une édition datée ne change plus après
// publication, sauf dépublication (visible au plus une heure après).
export const revalidate = 3600;

/**
 * Liste VIDE, volontairement (2026-11-18, quota CPU Vercel). Sans
 * `generateStaticParams`, Next rend une route à segment dynamique À CHAQUE
 * requête : le `revalidate` ci-dessus n'avait aucun effet. Avec une liste vide,
 * rien n'est construit au build ; chaque page est rendue à sa première visite
 * puis servie depuis le cache ISR. Une clé inconnue répond toujours 404.
 */
export async function generateStaticParams() {
  return [];
}

interface Item { code: string; sens: string; raison: string; metrics: HebdoMetrics; narratif_md: string; post_long: string; post_court: string; ordre: number }

async function load(date: string) {
  const db = createPublicClient();
  const { data: ed } = await db.from('hebdo_editions').select('id, date_edition').eq('date_edition', date).maybeSingle();
  if (!ed) return null;
  const { data: items } = await db
    .from('hebdo_items')
    .select('code, sens, raison, metrics, narratif_md, post_long, post_court, ordre')
    .eq('edition_id', (ed as { id: string }).id)
    .order('ordre');
  return { date: (ed as { date_edition: string }).date_edition, items: (items ?? []) as Item[] };
}

export async function generateMetadata(props: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const params = await props.params;
  const e = await load(params.date);
  if (!e) return { title: 'Édition introuvable' };
  const codes = e.items.map((i) => i.code).join(', ');
  return {
    title: `Analyse hebdo BRVM du ${e.date} — ${codes}`,
    description: `Les valeurs en vue de la semaine sur la BRVM : ${codes}. Cours face au marché et au secteur, valorisation, liquidité, lecture technique.`,
  };
}

const fmtVariation = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2).replace('.', ',')} %`;

export default async function HebdoEditionPage(props: { params: Promise<{ date: string }> }) {
  const params = await props.params;
  const e = await load(params.date);
  if (!e) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <FilAriane variante="public" className="mb-2" />
      <Link
        href="/analyses/hebdo"
        className="mb-6 inline-flex min-h-[44px] items-center gap-1.5 rounded text-sm text-muted transition-colors hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        Toutes les éditions
      </Link>
      <EnTeteCote
        titre={`Les valeurs en vue, semaine du ${fmtDateCourte(e.date)}`}
        description="Lecture de la semaine sur les données réelles de la BRVM : cours face au marché et au secteur, valorisation, liquidité, RSI sur 14 séances, canal des 20 séances."
        compte={{ n: e.items.length, libelle: e.items.length > 1 ? 'valeurs' : 'valeur' }}
        source={null}
      />

      {e.items.map((it) => {
        const m = it.metrics;
        return (
          <section key={it.code} aria-labelledby={`v-${it.code}`} className="mt-12 border-t border-border-strong pt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id={`v-${it.code}`} className="font-display text-2xl text-ivory">
                <Link href={`/actions/${it.code}`} className="rounded font-mono font-medium hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  {it.code}
                </Link>
              </h2>
              <p className="text-sm">
                <span className="tabular text-ivory">{fmtNumber(m.dernier)} FCFA</span>
                {m.variationHebdo != null && (
                  <span className={`tabular ml-3 ${m.variationHebdo >= 0 ? 'text-up' : 'text-down'}`}>
                    {fmtVariation(m.variationHebdo)} sur la semaine
                  </span>
                )}
              </p>
            </div>
            <p className="mt-1 text-sm text-muted">{it.raison}</p>

            <div className="mt-5 rounded-card border border-border bg-surface p-4">
              <HebdoChart
                dates={m.dates} closes={m.closes} rsi={m.rsi}
                resistance={m.levels?.resistance ?? null} support={m.levels?.support ?? null}
              />
            </div>

            <div className="mt-6 max-w-[72ch] space-y-4">
              {it.narratif_md.split(/^##\s+/m).filter(Boolean).map((bloc, i) => {
                const nl = bloc.indexOf('\n');
                const titre = nl >= 0 ? bloc.slice(0, nl).trim() : bloc;
                const texte = nl >= 0 ? bloc.slice(nl + 1).trim() : '';
                return (
                  <div key={i}>
                    <h3 className="text-base font-medium text-ivory">{titre}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{texte}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <CopyPostButton texte={it.post_long} label="LinkedIn" />
              <CopyPostButton texte={it.post_court} label="WhatsApp" />
              <a
                href={`/api/hebdo/${e.date}/image?code=${it.code}`}
                download
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-muted transition-colors hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:min-h-[32px]"
              >
                <Download aria-hidden className="h-3.5 w-3.5" />
                Télécharger l’image
              </a>
            </div>
          </section>
        );
      })}

      <section aria-labelledby="lexique-titre" className="mt-12 border-t border-border pt-6">
        <h2 id="lexique-titre" className="text-lg font-medium text-ivory">Lexique</h2>
        <dl className="mt-3 max-w-[72ch] space-y-2 text-sm leading-relaxed text-muted">
          <div>
            <dt className="inline text-ivory">RSI (Relative Strength Index). </dt>
            <dd className="inline">Mesure de 0 à 100 de la vitesse à laquelle un titre a été acheté ou vendu récemment. Au-dessus de 70 on parle de surachat, en dessous de 30 de survente.</dd>
          </div>
          <div>
            <dt className="inline text-ivory">MACD. </dt>
            <dd className="inline">Compare deux moyennes de prix de vitesses différentes pour repérer un changement de dynamique ; positif, il accompagne une tendance haussière.</dd>
          </div>
          <div>
            <dt className="inline text-ivory">Support et résistance. </dt>
            <dd className="inline">Bornes basse et haute des 20 séances précédentes, qui forment le canal. On ne parle de sortie de canal qu’au-delà d’un écart de 1 % (la variation médiane d’une séance sur la cote) ; en deçà, le cours est au contact de sa borne.</dd>
          </div>
          <div>
            <dt className="inline text-ivory">PER. </dt>
            <dd className="inline">Capitalisation rapportée au résultat net consolidé du dernier exercice : le nombre d’années de bénéfice que le cours représente. Il n’est calculé que si le bénéfice par action publié concorde avec le résultat divisé par le nombre de titres.</dd>
          </div>
          <div>
            <dt className="inline text-ivory">Fourchette. </dt>
            <dd className="inline">Écart entre la meilleure offre d’achat et la meilleure offre de vente du carnet d’ordres publié par la BRVM, rapporté à leur milieu.</dd>
          </div>
          <div>
            <dt className="inline text-ivory">Classe de liquidité. </dt>
            <dd className="inline">De A (négociable sans friction) à D (très illiquide), selon la présence du titre aux séances, la valeur échangée, l’impact des échanges sur le prix et la fourchette.</dd>
          </div>
        </dl>
        <LigneSource>
          Analyse technique produite automatiquement à partir des cours de clôture réels de la BRVM. Contenu informatif et
          pédagogique : ce n’est pas un conseil en investissement.
        </LigneSource>
      </section>
    </div>
  );
}
