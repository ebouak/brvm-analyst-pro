import { createPublicClient } from '@/lib/supabase/public';
import { aggregateBySector } from '@/lib/sectors';
import SectorsExport from '@/components/SectorsExport';
import SectorCard from '@/components/SectorCard';
import SectorRankingTable from '@/components/SectorRankingTable';
import SectorRotation from '@/components/SectorRotation';
import ValorisationSecteurs from '@/components/secteurs/ValorisationSecteurs';
import NewsletterForm from '@/components/NewsletterForm';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  PremiumPanel,
  EmptyStatePremium,
} from '@/components/ui/premium';
import { getDonneesSecteurs } from '@/lib/secteurs/server';
import { fmtPctSigne } from '@/lib/format';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { SommaireChapitres } from '@/components/marche/SommaireChapitres';
import { LigneSource } from '@/components/marche/LigneSource';
import { Chapitre } from '@/components/fiche/Chapitre';

// Donnees marche publiques (RLS lecture publique), rafraichies toutes les 15 min
// par l'intraday : ISR 5 min (audit 2026-06-12).
export const revalidate = 300;
// Page PUBLIQUE (whitelist du middleware) : « PER BRVM », « rendement dividende
// BRVM » sont des requêtes réelles, et la valorisation sectorielle est de la
// donnée de marché, sans rien de personnel.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

/** Couleur du sens d'une variation : vert en hausse, rouge en baisse, neutre à zéro. */
const sens = (v: number) => (v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-muted');

/** "2026-11-03" → "3 nov. 2026" (affichage seul). */
function fmtDateFR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export const metadata: import('next').Metadata = {
  title: 'Secteurs BRVM — performance, PER, PBR et rendement du dividende',
  description:
    "Performance et valorisation des secteurs cotés à la BRVM : variation, classement, rotation, puis PER, PBR et rendement du dividende médians, calculés sur les états financiers publiés.",
  keywords: ['secteurs BRVM', 'PER BRVM', 'PBR BRVM', 'rendement dividende BRVM', 'valorisation sectorielle UEMOA'],
  alternates: { canonical: SITE_URL + '/secteurs' },
  openGraph: {
    type: 'website',
    title: 'Secteurs BRVM — performance et valorisation',
    description: 'Variation, classement et rotation des secteurs cotés, puis PER, PBR et rendement du dividende médians.',
    url: SITE_URL + '/secteurs',
  },
};

interface ActionRow {
  code: string; secteur: string | null; date_marche: string;
  cours_jour: number | null; variation_pct: number | null; valeur_echangee: number | null;
}

/** Récupère toutes les lignes depuis `fromDate` en paginant (plafond 1000/req). */
async function fetchAllActionsSince(
  supabase: ReturnType<typeof createPublicClient>,
  fromDate: string,
): Promise<ActionRow[]> {
  const PAGE = 1000;
  const all: ActionRow[] = [];
  for (let from = 0; from < 50000; from += PAGE) {
    const { data } = await supabase
      .from('brvm_actions_daily')
      .select('code, secteur, date_marche, cours_jour, variation_pct, valeur_echangee')
      .gte('date_marche', fromDate)
      .order('date_marche', { ascending: true })
      .range(from, from + PAGE - 1);
    const batch = (data ?? []) as ActionRow[];
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  return all;
}

async function getData() {
  const supabase = createPublicClient();

  // Dernière date disponible
  const { data: lastRow } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);

  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return { lastDate: null, perfs: [] };

  // 1 an d'historique
  const oneYearAgo = new Date(lastDate);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const fromDate = oneYearAgo.toISOString().slice(0, 10);

  // ⚠️ PostgREST plafonne à 1000 lignes/réponse. Sur 1 an × ~47 actions (~12k
  // lignes), un fetch unique trié ASC ne renvoyait que le 1er mois → la dernière
  // séance était tronquée → 0 hausse / 0 baisse / Vol 0. On pagine via .range().
  const [rows, { data: instruments }] = await Promise.all([
    fetchAllActionsSince(supabase, fromDate),
    supabase.from('brvm_instruments').select('code, secteur'),
  ]);

  // Le secteur de brvm_actions_daily est rarement renseigné : on le complète
  // depuis le référentiel brvm_instruments (source de vérité des secteurs).
  const sectorByCode: Record<string, string | null> = {};
  for (const i of (instruments ?? []) as { code: string; secteur: string | null }[]) {
    sectorByCode[i.code] = i.secteur;
  }
  const enriched = rows.map((r) => ({
    ...r,
    secteur: r.secteur ?? sectorByCode[r.code] ?? null,
  }));

  const perfs = aggregateBySector(enriched, lastDate);

  return { lastDate, perfs };
}

export default async function SecteursPage() {
  const [{ lastDate, perfs }, valo] = await Promise.all([getData(), getDonneesSecteurs()]);
  const top4 = perfs.slice(0, 4);
  const best = perfs[0] ?? null;
  const worst = perfs[perfs.length - 1] ?? null;
  const avecValo = valo.secteurs.length > 0;

  const chapitres = perfs.length === 0 ? [] : [
    { id: 'tete', label: 'En tête du jour' },
    { id: 'classement', label: 'Multi-horizon' },
    { id: 'rotation', label: 'Rotation 30 j' },
    ...(avecValo ? [{ id: 'valorisation', label: 'Valorisation' }] : []),
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <EnTeteCote
        titre="Performance sectorielle"
        description="Classement, rotation et valorisation des secteurs cotés à la BRVM."
        seance={lastDate}
        compte={perfs.length > 0 ? { n: perfs.length, libelle: 'secteurs' } : null}
        source={lastDate ? 'Source BRVM' : null}
        actions={perfs.length > 0 ? <SectorsExport rows={perfs} /> : undefined}
      />
      <SommaireChapitres chapitres={chapitres} />

      {perfs.length === 0 ? (
        <div className="mt-8">
          <EmptyStatePremium
            title="Aucune donnée sectorielle disponible"
            hint="Le classement des secteurs s’affichera après la première séance collectée."
            action={{ href: '/', label: 'Retour à l’accueil' }}
          />
        </div>
      ) : (
        <>
          {/* ── 01 : Top secteurs du jour ─────────────────────────────────── */}
          <section aria-labelledby="tete-titre">
            <Chapitre
              id="tete"
              numero="01"
              titre="Secteurs en tête du jour"
              sousTitre="Les quatre secteurs à la plus forte variation moyenne sur la séance."
              premier
            />
            {(best?.varDay != null || worst?.varDay != null) && (
              <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
                {best && best.varDay != null && (
                  <div className="flex gap-1.5">
                    <dt>Meilleur secteur</dt>
                    <dd>
                      <span className="text-ivory">{best.secteur}</span>{' '}
                      <span className={`tabular ${sens(best.varDay)}`}>{fmtPctSigne(best.varDay)}</span>
                    </dd>
                  </div>
                )}
                {worst && worst.varDay != null && worst.secteur !== best?.secteur && (
                  <div className="flex gap-1.5">
                    <dt>Le plus faible</dt>
                    <dd>
                      <span className="text-ivory">{worst.secteur}</span>{' '}
                      <span className={`tabular ${sens(worst.varDay)}`}>{fmtPctSigne(worst.varDay)}</span>
                    </dd>
                  </div>
                )}
              </dl>
            )}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {top4.map((p, i) => (
                <SectorCard key={p.secteur} perf={p} rang={i + 1} />
              ))}
            </div>
          </section>

          {/* ── 02 : Classement complet ───────────────────────────────────── */}
          <section aria-labelledby="classement-titre">
            <Chapitre
              id="classement"
              numero="02"
              titre="Performance multi-horizon"
              sousTitre="Tous les secteurs, du jour à un an, triables par colonne."
            />
            <div className="mt-6">
              <PremiumPanel>
                <div className="p-1">
                  <SectorRankingTable perfs={perfs} />
                </div>
              </PremiumPanel>
            </div>
          </section>

          {/* ── 03 : Rotation sectorielle ─────────────────────────────────── */}
          <section aria-labelledby="rotation-titre">
            <Chapitre
              id="rotation"
              numero="03"
              titre="Rotation sectorielle sur 30 jours"
              sousTitre="Performance sur 30 jours face à 90 jours : quels secteurs mènent, lesquels s’essoufflent."
            />
            <div className="mt-6">
              <PremiumPanel>
                <div className="p-4">
                  <SectorRotation perfs={perfs} />
                </div>
              </PremiumPanel>
            </div>
          </section>

          {/* ── 04 : Valorisation (PER, PBR, rendement) ───────────────────── */}
          {avecValo && (
            <ValorisationSecteurs
              entete={
                <Chapitre
                  id="valorisation"
                  numero="04"
                  titre="À quel prix se paie chaque secteur"
                  sousTitre="PER, PBR et rendement du dividende médians, calculés sur les états financiers publiés."
                />
              }
            />
          )}
          {lastDate && (
            <LigneSource>
              Variations calculées sur les cours publiés par la BRVM, séance du{' '}
              <time dateTime={lastDate}>{fmtDateFR(lastDate)}</time>.
            </LigneSource>
          )}
        </>
      )}

      {/* ── Lien vers la cartographie ───────────────────────────────────── */}
      <div className="mt-16 flex flex-col gap-4 rounded-card border border-border bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-ivory">Voir la cartographie du marché</p>
          <p className="mt-0.5 text-xs text-muted">
            Une tuile par société : sa taille suit la capitalisation, sa couleur la variation de la séance.
          </p>
        </div>
        <Link
          href="/heatmap"
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border-strong px-4 text-sm font-medium text-accent-ink transition-colors hover:border-accent hover:bg-elevated active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Ouvrir la cartographie
          <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
        </Link>
      </div>

      {/* ── Newsletter ───────────────────────────────────────────────────── */}
      <div className="mt-6">
        <NewsletterForm source="secteurs" />
      </div>
    </div>
  );
}
