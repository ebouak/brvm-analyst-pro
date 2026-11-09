'use client';

import { useEffect, useState } from 'react';
import EChart from '@/components/EChart';
import { chartTheme } from '@/lib/chartTheme';
import { quadrant } from '@/lib/sectors';
import { fmtPctSigne } from '@/lib/format';
import type { SectorPerf } from '@/lib/sectors';
import type { EChartsOption } from 'echarts';

interface Props {
  perfs: SectorPerf[];
}

type Quadrant = 'leading' | 'improving' | 'weakening' | 'lagging';

/**
 * Lecture des quadrants, dans l'ordre où on les lit. Le libellé accompagne
 * toujours la couleur : la couleur seule ne porte jamais le sens.
 * Vert et rouge gardent leur sens de hausse et de baisse (les deux horizons
 * dans le même sens) ; les deux situations mixtes prennent l'accent et
 * l'avertissement du thème.
 */
const QUADRANTS: { cle: Quadrant; libelle: string; definition: string; jeton: 'up' | 'accent' | 'warn' | 'down'; pastille: string }[] = [
  { cle: 'leading', libelle: 'En tête', definition: 'en hausse sur 30 et sur 90 jours', jeton: 'up', pastille: 'bg-up' },
  { cle: 'improving', libelle: 'En reprise', definition: 'en hausse sur 30 jours, en baisse sur 90 jours', jeton: 'accent', pastille: 'bg-accent' },
  { cle: 'weakening', libelle: 'En essoufflement', definition: 'en baisse sur 30 jours, en hausse sur 90 jours', jeton: 'warn', pastille: 'bg-warn' },
  { cle: 'lagging', libelle: 'En retrait', definition: 'en baisse sur 30 et sur 90 jours', jeton: 'down', pastille: 'bg-down' },
];
const PAR_CLE = Object.fromEntries(QUADRANTS.map((q) => [q.cle, q])) as Record<Quadrant, (typeof QUADRANTS)[number]>;

/** Les noms de secteur viennent de la base : échappés avant d'entrer dans l'infobulle HTML d'ECharts. */
const echappe = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const pctAxe = (v: number) => fmtPctSigne(v, 1);

/** Relit les jetons quand le thème change (attribut data-theme ou classe sur <html>). */
function useVersionTheme(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const o = new MutationObserver(() => setVersion((v) => v + 1));
    o.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    return () => o.disconnect();
  }, []);
  return version;
}

/** Vrai sous 640 px (point de rupture `sm`) : libellés des bulles masqués, la légende les nomme. */
function useEtroit(): boolean {
  const [etroit, setEtroit] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const maj = () => setEtroit(mq.matches);
    maj();
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);
  return etroit;
}

export default function SectorRotation({ perfs }: Props) {
  useVersionTheme();
  const etroit = useEtroit();
  const validPerfs = perfs.filter((p) => p.var30d != null && p.var90d != null);

  if (validPerfs.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-border px-6 py-10 text-center text-sm text-muted">
        Pas encore assez d&apos;historique pour situer les secteurs sur 30 et 90 jours.
      </p>
    );
  }

  const T = chartTheme();
  const couleur = (q: Quadrant) => T[PAR_CLE[q].jeton];
  // Valeur échangée absente (séance non encore publiée) : bulles de taille égale, et la légende le dit.
  const volumeConnu = validPerfs.some((p) => p.volumeDay != null);
  const maxVol = Math.max(...validPerfs.map((p) => p.volumeDay ?? 0), 1);

  const points = validPerfs.map((p) => {
    const q = quadrant(p.var30d, p.var90d) ?? 'lagging';
    const size = volumeConnu ? Math.max(10, ((p.volumeDay ?? 0) / maxVol) * 50) : 16;
    return {
      secteur: p.secteur,
      quadrant: q,
      var30d: p.var30d as number,
      var90d: p.var90d as number,
      echart: {
        name: p.secteur,
        value: [p.var30d, p.var90d, size],
        quadrant: q,
        itemStyle: { color: couleur(q), opacity: 0.85, borderColor: T.surface, borderWidth: 1 },
      },
    };
  });

  const option: EChartsOption = {
    // Marge droite large : le libellé d'une bulle placée au bord (ex. « Énergie ») n'est plus rogné.
    grid: { top: 32, right: etroit ? 16 : 72, bottom: 48, left: etroit ? 8 : 24, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { name: string; value: [number, number, number]; data: { quadrant: Quadrant } };
        const q = PAR_CLE[p.data.quadrant];
        return [
          `<b>${echappe(p.name)}</b>`,
          `30 jours : ${fmtPctSigne(p.value[0] ?? 0)}`,
          `90 jours : ${fmtPctSigne(p.value[1] ?? 0)}`,
          q.libelle,
        ].join('<br/>');
      },
    },
    xAxis: {
      type: 'value',
      name: 'Variation sur 30 jours',
      nameLocation: 'middle',
      nameGap: 32,
      nameTextStyle: { color: T.muted, fontSize: 12 },
      axisLine: { lineStyle: { color: T.border } },
      axisLabel: { color: T.muted, fontSize: 11, formatter: pctAxe, hideOverlap: true },
      splitNumber: etroit ? 3 : 5,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: 'Variation sur 90 jours',
      nameLocation: 'middle',
      nameGap: 52,
      nameTextStyle: { color: T.muted, fontSize: 12 },
      axisLine: { show: false },
      axisLabel: { color: T.muted, fontSize: 11, formatter: pctAxe },
      splitLine: { lineStyle: { color: T.border, type: 'dashed' } },
    },
    series: [
      // Axes du zéro : ils séparent les quatre quadrants.
      {
        type: 'line' as const,
        data: [] as [],
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: T.alpha('muted', 0.5), type: 'solid', width: 1 },
          data: [{ xAxis: 0 }, { yAxis: 0 }],
          label: { show: false },
        },
      },
      {
        type: 'scatter' as const,
        data: points.map((p) => p.echart) as unknown as [],
        symbolSize: (val: unknown) => {
          const v = val as [number, number, number];
          return v[2] ?? 16;
        },
        label: {
          show: !etroit,
          formatter: '{b}',
          position: 'top',
          color: T.ivory,
          fontSize: 11,
        },
        labelLayout: { hideOverlap: true },
        emphasis: {
          scale: true,
          label: { show: true, fontWeight: 'bold', color: T.ivory, fontSize: 11 },
        },
      },
    ],
  };

  const parQuadrant = QUADRANTS.map((q) => ({
    ...q,
    secteurs: points.filter((p) => p.quadrant === q.cle).sort((a, b) => b.var30d - a.var30d),
  }));

  return (
    <figure>
      <figcaption className="text-xs text-muted">
        Horizontal : variation sur 30 jours. Vertical : variation sur 90 jours.{' '}
        {volumeConnu
          ? 'Taille de la bulle : valeur échangée sur la séance.'
          : 'Valeur échangée de la séance non publiée : toutes les bulles ont la même taille.'}
        <span className="sm:hidden"> Les secteurs sont nommés sous le graphique.</span>
      </figcaption>
      <div aria-hidden className="mt-3">
        <EChart option={option} height={420} />
      </div>

      {/* Lecture textuelle du graphique : légende, et les secteurs de chaque quadrant. */}
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-border pt-4 sm:grid-cols-2">
        {parQuadrant.map((q) => (
          <div key={q.cle}>
            <dt className="flex items-center gap-2 text-sm text-ivory">
              <span aria-hidden className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${q.pastille}`} />
              <span className="font-medium">{q.libelle}</span>
              <span className="text-xs text-faint">{q.definition}</span>
            </dt>
            <dd className="mt-1 pl-[18px] text-xs text-muted">
              {q.secteurs.length === 0
                ? <span className="text-faint">Aucun secteur</span>
                : q.secteurs.map((s, i) => (
                  <span key={s.secteur}>
                    {i > 0 && ', '}
                    {s.secteur}
                  </span>
                ))}
            </dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}
