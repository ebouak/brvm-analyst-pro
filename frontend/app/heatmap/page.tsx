import { createClient } from '@/lib/supabase/server';
import HeatmapViews, { SecteurSelect } from '@/components/HeatmapViews';
import brvmLogos from '@/lib/brvmLogos.json';
import { loadHeatmap } from '@/lib/heatmapData';
import { VAR_PLEINE } from '@/lib/heatmap';
import type { HeatmapNode } from '@/lib/heatmap';
import Link from 'next/link';
import { fmtPctSigne, fmtDateCourte } from '@/lib/format';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { LigneSource } from '@/components/marche/LigneSource';
import { Chapitre } from '@/components/fiche/Chapitre';
import {
  PremiumPanel,
  EmptyStatePremium,
} from '@/components/ui/premium';

/* Hallmark · checked: 2026-11-09 · genre: modern-minimal (inferred) · shape: app screen
 * signature: la cartographie de la séance · states: vide (séance, secteur, filtre couleur), chargement (squelette de la route)
 * built: the project · redesign: full · scope: app · v2.0.0 */

interface SectorStat {
  secteur: string;
  count: number;
  hausses: number;
  baisses: number;
  avgVar: number;
  volume: number;
  topHausse: { code: string; pct: number } | null;
  topBaisse: { code: string; pct: number } | null;
}

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Heatmap marché' };

/**
 * Échelle de la légende : jetons up / down, alignés sur couleurVariation()
 * (lib/heatmap.ts) : neutre à 0, teinte pleine à ±VAR_PLEINE.
 * Classes Tailwind statiques, aucun style en ligne.
 */
const GRADIENT_STOPS: { pct: number; bgClass: string }[] = [
  { pct: -VAR_PLEINE, bgClass: 'bg-down' },
  { pct: -VAR_PLEINE / 2, bgClass: 'bg-down/60' },
  { pct: 0, bgClass: 'bg-border-strong' },
  { pct: VAR_PLEINE / 2, bgClass: 'bg-up/60' },
  { pct: VAR_PLEINE, bgClass: 'bg-up' },
];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function getData(secteur: string | null) {
  const supabase = createClient();
  const { lastDate, rows: enriched } = await loadHeatmap(supabase);
  if (!lastDate) return { lastDate: null, rows: [] as HeatmapNode[], allSectors: [] as string[] };

  // Liste complète des secteurs (avant filtre) pour les chips.
  const allSectors = Array.from(new Set<string>(enriched.map((r) => r.secteur ?? 'Autre'))).sort();

  const rows = secteur ? enriched.filter((r) => r.secteur === secteur) : enriched;

  // Statistiques par secteur pour le panel d'information
  const sectorMap = new Map<string, SectorStat>();
  for (const r of enriched) {
    const sec = r.secteur ?? 'Autre';
    if (!sectorMap.has(sec)) {
      sectorMap.set(sec, { secteur: sec, count: 0, hausses: 0, baisses: 0, avgVar: 0, volume: 0, topHausse: null, topBaisse: null });
    }
    const s = sectorMap.get(sec)!;
    const v = (r as { variation_pct?: number | null }).variation_pct ?? 0;
    const vol = (r as { volume?: number | null }).volume ?? 0;
    s.count++;
    s.avgVar += v;
    s.volume += vol;
    if (v > 0) { s.hausses++; if (!s.topHausse || v > s.topHausse.pct) s.topHausse = { code: r.code, pct: v }; }
    if (v < 0) { s.baisses++; if (!s.topBaisse || v < s.topBaisse.pct) s.topBaisse = { code: r.code, pct: v }; }
  }
  const sectorStats: SectorStat[] = Array.from(sectorMap.values()).map((s) => ({
    ...s,
    avgVar: s.count > 0 ? s.avgVar / s.count : 0,
  })).sort((a, b) => b.avgVar - a.avgVar);

  return { lastDate, rows, allSectors, sectorStats } as const;
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Légende de la carte, posée dans sa barre d'outils. */
function LegendeVariation() {
  const bas = fmtPctSigne(-VAR_PLEINE, 0);
  const haut = fmtPctSigne(VAR_PLEINE, 0);
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span className="whitespace-nowrap">Variation du jour</span>
      <span className="tabular">{bas}</span>
      <span aria-hidden className="flex h-2.5 w-28 shrink-0 overflow-hidden rounded-sm sm:w-36">
        {GRADIENT_STOPS.map((stop) => (
          <span key={stop.pct} className={`flex-1 ${stop.bgClass}`} />
        ))}
      </span>
      <span className="tabular">{haut}</span>
      <span className="sr-only">
        Rouge pour une baisse, vert pour une hausse, gris pour une valeur inchangée ; la teinte est
        pleine à partir de {haut} ou {bas}.
      </span>
    </div>
  );
}

/** Une ligne du panneau secteurs : moyenne, largeur (hausses, stables, baisses), valeur en tête. */
function LigneSecteur({ s, actif }: { s: SectorStat; actif: boolean }) {
  const avg = s.avgVar;
  const color = avg > 0 ? 'text-up' : avg < 0 ? 'text-down' : 'text-muted';
  const stables = s.count - s.hausses - s.baisses;
  return (
    <li>
      <Link
        href={actif ? '/heatmap' : `/heatmap?secteur=${encodeURIComponent(s.secteur)}`}
        aria-current={actif ? 'true' : undefined}
        title={actif ? 'Afficher tous les secteurs' : `Filtrer la carte sur ${s.secteur}`}
        className={[
          'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5 px-3 py-2.5 transition-colors',
          'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
          actif ? 'bg-accent/10' : 'hover:bg-elevated active:bg-elevated',
        ].join(' ')}
      >
        <span className={`truncate text-sm font-medium ${actif ? 'text-accent-ink' : 'text-ivory'}`}>{s.secteur}</span>
        <span className={`tabular text-right text-sm font-semibold ${color}`}>{fmtPctSigne(avg)}</span>

        {/* Largeur du secteur : parts de hausses, de stables et de baisses. */}
        <span aria-hidden className="col-span-2 flex h-1.5 gap-px overflow-hidden rounded-sm bg-border">
          {s.hausses > 0 && <span className="bg-up" style={{ flexGrow: s.hausses }} />}
          {stables > 0 && <span className="bg-border-strong" style={{ flexGrow: stables }} />}
          {s.baisses > 0 && <span className="bg-down" style={{ flexGrow: s.baisses }} />}
        </span>

        <span className="tabular truncate text-xs text-muted">
          {pluriel(s.hausses, 'hausse')}, {pluriel(s.baisses, 'baisse')}, {pluriel(stables, 'stable')}
        </span>
        <span className="tabular whitespace-nowrap text-right text-xs text-muted">
          {s.topHausse ? (
            <>
              <span className="text-faint">en tête </span>
              {s.topHausse.code} <span className="text-up">{fmtPctSigne(s.topHausse.pct, 1)}</span>
            </>
          ) : (
            <span className="text-faint">aucune hausse</span>
          )}
        </span>
      </Link>
    </li>
  );
}

export default async function HeatmapPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const secteurParam = typeof searchParams.secteur === 'string' ? searchParams.secteur : null;
  const result = await getData(secteurParam);
  const { lastDate, rows, allSectors } = result;
  const sectorStats: SectorStat[] = result.sectorStats ?? [];
  const secteurVide = rows.length === 0 && !!secteurParam;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <div className="relative flex flex-col flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-8">

        <EnTeteCote
          titre="Heatmap marché"
          description="Chaque action cotée à la BRVM : la surface suit la capitalisation, la couleur suit la variation du jour."
          seance={lastDate}
          compte={lastDate ? { n: rows.length, libelle: secteurParam ? `valeurs du secteur ${secteurParam}` : 'valeurs' } : null}
          source={lastDate ? 'Source BRVM' : null}
        />

        {!lastDate ? (
          <div className="mt-8 flex-1 flex items-center justify-center">
            <EmptyStatePremium
              title="Aucune séance disponible"
              hint="Les données de marché apparaîtront ici dès la prochaine collecte."
              action={{ href: '/', label: "Retour à l'accueil" }}
            />
          </div>
        ) : (
          /* La carte mène ; à partir de lg, le panneau secteurs se range à
             sa droite et la filtre. En dessous, il suit la carte. */
          <div className="grid flex-1 grid-cols-1 gap-x-8 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="min-w-0">
              <Chapitre
                id="cartographie"
                numero="01"
                titre="Cartographie de la séance"
                sousTitre="Cliquez sur une case pour ouvrir la fiche de la valeur."
                premier
              />

              {/* Secteur, mobile : liste déroulante (les puces occupaient tout
                  le premier écran). Le panneau secteurs filtre à partir de md. */}
              {allSectors.length > 0 && (
                <SecteurSelect secteurs={allSectors} courant={secteurParam} className="mt-5 w-full md:hidden" />
              )}

              <div className="mt-5">
                {secteurVide ? (
                  <EmptyStatePremium
                    title={`Aucune action dans « ${secteurParam} »`}
                    hint="Ce secteur ne comporte pas d'actions cotées pour cette séance."
                    action={{ href: '/heatmap', label: 'Voir tous les secteurs' }}
                  />
                ) : (
                  <PremiumPanel>
                    <div className="p-3 sm:p-4 min-h-[420px]">
                      <HeatmapViews
                        rows={rows}
                        logos={brvmLogos as Record<string, string>}
                        legende={<LegendeVariation />}
                      />
                    </div>
                  </PremiumPanel>
                )}
              </div>

              <LigneSource>
                Cours et variations publiés par la BRVM, séance du{' '}
                <time dateTime={lastDate}>{fmtDateCourte(lastDate)}</time>. Taille selon la capitalisation
                (cours × nombre de titres), à défaut la valeur échangée.
              </LigneSource>
            </div>

            {sectorStats.length > 0 && (
              <section aria-label="Performance par secteur" className="min-w-0">
                <Chapitre
                  id="par-secteur"
                  numero="02"
                  titre="Performance par secteur"
                  sousTitre="Variation moyenne, largeur et meilleure valeur de chaque secteur. Un clic filtre la carte."
                  premier
                />
                <ul className="mt-5 divide-y divide-border border-y border-border">
                  {sectorStats.map((s) => (
                    <LigneSecteur key={s.secteur} s={s} actif={secteurParam === s.secteur} />
                  ))}
                </ul>

                <Link
                  href="/secteurs"
                  className="mt-3 inline-flex min-h-[44px] items-center px-1 text-sm text-accent-ink underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  Analyse sectorielle complète
                </Link>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
