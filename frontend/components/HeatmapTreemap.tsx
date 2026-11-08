'use client';

import { useRouter } from 'next/navigation';
import EChart from '@/components/EChart';
import { couleurVariation, groupBySector, nodeWeight, paletteDepuisTheme } from '@/lib/heatmap';
import { chartTheme } from '@/lib/chartTheme';
import type { HeatmapNode } from '@/lib/heatmap';
import { fmtFcfa, fmtNumber, fmtPctSigne } from '@/lib/format';

/** « SNTS : +1,95 % » — libellé accessible d'une tuile (format français). */
export function libelleTuile(code: string, pct: number | null): string {
  return `${code} : ${pct == null ? 'variation indisponible' : fmtPctSigne(pct)}`;
}

/** Luminance relative WCAG 2.x d'une couleur #rrggbb. */
function luminanceWcag(hex: string): number {
  const c = hex.replace('#', '');
  const ch = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Texte (blanc ou #030303) offrant le meilleur contraste WCAG sur ce fond. */
function textOn(bg: string): string {
  const l = luminanceWcag(bg);
  const contrasteBlanc = 1.05 / (l + 0.05);
  const contrasteSombre = (l + 0.05) / (0.0009 + 0.05);
  return contrasteSombre > contrasteBlanc ? '#030303' : '#ffffff';
}

/** Filtre couleur : toutes, hausses (vert) ou baisses (rouge) uniquement. */
export type ColorFilter = 'all' | 'up' | 'down';

interface Props {
  data: HeatmapNode[];
  height?: number;
  /** Logos par code (chemins /logos/XXX.ext) — affichés dans les tuiles. */
  logos?: Record<string, string | null>;
  /** Filtre couleur appliqué avant le rendu. */
  colorFilter?: ColorFilter;
  /** Ratio largeur/hauteur estimé du conteneur (sert au dimensionnement des logos). */
  aspect?: number;
}

/** Custom fields we embed into each leaf node for tooltip/click access. */
interface LeafExtra {
  code: string;
  designation: string | null;
  variation_pct: number | null;
  cours_jour: number | null;
  volume: number | null;
  capitalisation: number | null;
}

export default function HeatmapTreemap({ data, height = 600, logos = {}, colorFilter = 'all', aspect = 2 }: Props) {
  const router = useRouter();

  // Filtre couleur : on retire les tuiles hors-catégorie avant tout regroupement.
  const filtered =
    colorFilter === 'up'
      ? data.filter((n) => (n.variation_pct ?? 0) > 0)
      : colorFilter === 'down'
      ? data.filter((n) => (n.variation_pct ?? 0) < 0)
      : data;

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-sm rounded-lg bg-elevated text-muted"
        style={{ height }}
      >
        Pas de séance disponible
      </div>
    );
  }

  if (!filtered.length) {
    return (
      <div
        className="flex items-center justify-center text-sm rounded-lg bg-elevated text-muted"
        style={{ height }}
      >
        {colorFilter === 'up' ? 'Aucune hausse sur cette séance.' : 'Aucune baisse sur cette séance.'}
      </div>
    );
  }

  const sectors = groupBySector(filtered);

  // Jetons du thème courant (clair ou sombre) : le treemap suit le thème.
  const T = chartTheme();
  const palette = paletteDepuisTheme(T);
  const couleurTuile = (pct: number | null): string => couleurVariation(pct, palette);

  // Dimensionnement proportionnel des logos : on estime la surface en pixels de
  // chaque tuile à partir de sa part de capitalisation et des dimensions
  // estimées du conteneur (hauteur réelle × ratio largeur/hauteur). Le côté
  // ≈ √(surface) donne une taille de logo cohérente avec la tuile — et l'on
  // masque le logo sur les tuiles trop petites (sinon il déborde et paraît
  // « cassé »).
  // Surface utile ≈ 85 % du conteneur : bandeaux de secteur (22 px) et
  // espacements entre tuiles mangent le reste.
  const estW = height * aspect;
  const estH = height * 0.85;
  const grandTotal = sectors.reduce(
    (sum, s) => sum + s.children.reduce((c, n) => c + Math.max(nodeWeight(n), 1), 0),
    0,
  );

  // Build the ECharts treemap data. We cast once at assignment because ECharts'
  // internal TreemapSeriesNodeItemOption is too narrow for our extra fields
  // (custom tooltip data, per-node rich labels with logo images, etc.).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const treemapData: any[] = sectors.map((sector) => ({
    name: sector.name,
    itemStyle: { color: 'transparent', borderColor: T.surface, borderWidth: 3 },
    upperLabel: { show: true, color: T.muted, fontSize: 11, fontWeight: 'bold' as const },
    children: sector.children.map((node) => {
      const varStr = node.variation_pct != null ? fmtPctSigne(node.variation_pct) : '';
      const logoUrl = logos[node.code];

      // Côté estimé de la tuile (px) → taille de logo et de police proportionnelles.
      const weight = Math.max(nodeWeight(node), 1);
      const side = grandTotal > 0 ? Math.sqrt((weight / grandTotal) * estW * estH) : 0;
      const codeFont = Math.round(Math.min(22, Math.max(11, side * 0.13)));
      const varFont = Math.max(9, codeFont - 3);
      // PRIORITÉ AU TEXTE : code + variation d'abord, le logo seulement avec la
      // place restante. ECharts tronque un libellé trop haut PAR LE BAS : un
      // logo placé au-dessus faisait disparaître la variation (SIBC, ECOC,
      // BOAC n'affichaient que leur logo). On raisonne sur le côté COURT
      // probable d'une tuile « squarifiée » (ratio jusqu'à ~2:1 → côté / √2).
      const textH = codeFont + 4 + (varFont + 4);
      const coteCourt = side / Math.SQRT2;
      const logoPx = Math.round(Math.min(72, side * 0.42, coteCourt - textH - 14));

      // Rich label : logo (si la tuile est assez grande) au-dessus du code + variation.
      // Le rich doit être porté par CHAQUE nœud — sinon ECharts affiche le markup brut.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fond = couleurTuile(node.variation_pct);
      const fg = textOn(fond);
      const rich: any = {
        code: { color: fg, fontSize: codeFont, fontWeight: 'bold', lineHeight: codeFont + 4 },
        var: { color: fg, fontSize: varFont, lineHeight: varFont + 4 },
      };
      // Jamais le code seul : deux lignes si la hauteur le permet, sinon
      // « CODE +x,xx % » sur une ligne si la largeur le permet, sinon rien.
      const deuxLignes = coteCourt >= textH + 4;
      const largeurUneLigne = (node.code.length + 1 + varStr.length) * codeFont * 0.62;
      const uneLigne = !deuxLignes && coteCourt >= codeFont + 6 && largeurUneLigne <= side * 0.92;
      let formatter = deuxLignes
        ? `{code|${node.code}}\n{var|${varStr}}`
        : `{code|${node.code}} {var|${varStr}}`;
      if (logoUrl && logoPx >= 18) {
        rich.logo = {
          height: logoPx,
          width: logoPx,
          align: 'center',
          backgroundColor: { image: logoUrl },
        };
        formatter = `{logo|}\n{code|${node.code}}\n{var|${varStr}}`;
      }

      return {
        name: node.code,
        value: Math.max(nodeWeight(node), 1),
        // Extra fields for tooltip + click handler
        code: node.code,
        designation: node.designation,
        variation_pct: node.variation_pct,
        cours_jour: node.cours_jour,
        volume: node.volume,
        capitalisation: node.capitalisation ?? null,
        itemStyle: { color: fond },
        label: {
          // Texte réservé aux tuiles assez grandes (≈ 60 px de côté).
          show: side >= 60 && (deuxLignes || uneLigne),
          formatter,
          rich,
          color: fg,
          overflow: 'truncate' as const,
        },
      };
    }),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipFormatter = (params: any): string => {
    const d = params?.data as (LeafExtra & { name: string }) | undefined;
    if (!d?.code) return (params?.name as string) ?? '';
    const varVal = d.variation_pct;
    const varColor = varVal != null && varVal >= 0 ? T.up : T.down;
    const varStr =
      varVal != null
        ? `<span style="color:${varColor};font-weight:600">${fmtPctSigne(varVal)}</span>`
        : '—';
    return [
      `<div style="padding:4px 2px">`,
      `<div style="font-weight:700;font-size:13px;color:${T.ivory}">${d.code}</div>`,
      `<div style="color:${T.muted};font-size:11px;margin-bottom:6px">${d.designation ?? ''}</div>`,
      `<div>Prix : <b>${fmtFcfa(d.cours_jour)} FCFA</b></div>`,
      `<div>Variation : ${varStr}</div>`,
      `<div>Volume : <b>${fmtNumber(d.volume ?? 0)}</b> titres</div>`,
      d.capitalisation != null
        ? `<div>Capitalisation : <b>${fmtFcfa(d.capitalisation)} FCFA</b></div>`
        : '',
      `</div>`,
    ].join('');
  };

  // Accessibilité : le treemap est un canvas, ses tuiles ne sont pas des
  // éléments du DOM. ECharts pose cette description en aria-label du
  // conteneur : chaque valeur y figure sous la forme « CODE : +x,xx % ».
  const description =
    `Cartographie de ${filtered.length} valeur${filtered.length > 1 ? 's' : ''}, ` +
    `taille selon la capitalisation, couleur selon la variation du jour. ` +
    sectors
      .map((sec) => `${sec.name} — ${sec.children.map((n) => libelleTuile(n.code, n.variation_pct)).join(' ; ')}`)
      .join('. ') +
    '.';

  const option = {
    backgroundColor: 'transparent',
    aria: { enabled: true, label: { enabled: true, description } },
    tooltip: {
      backgroundColor: T.surface,
      borderColor: T.border,
      borderWidth: 1,
      textStyle: { color: T.ivory, fontSize: 12 },
      formatter: tooltipFormatter,
    },
    series: [
      {
        type: 'treemap' as const,
        data: treemapData,
        width: '100%',
        height: '100%',
        top: 0,
        left: 0,
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        levels: [
          {
            // Sector level
            itemStyle: { borderColor: T.surface, borderWidth: 3, gapWidth: 3 },
            upperLabel: {
              show: true,
              height: 22,
              color: T.muted,
              fontSize: 11,
              fontWeight: 'bold' as const,
              backgroundColor: T.alpha('surface', 0.7),
              padding: [3, 6] as [number, number],
            },
          },
          {
            // Leaf level — bordures (le label/rich est porté par chaque nœud).
            itemStyle: { borderColor: T.border, borderWidth: 1, gapWidth: 1 },
          },
        ],
      },
    ],
  };

  const onEvents = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    click: (params: any) => {
      const code = params?.data?.code as string | undefined;
      if (code) router.push(`/actions/${code}`);
    },
  };

  return (
    <EChart
      // Cast needed: EChartsOption's series union doesn't accommodate our
      // custom treemap node fields; the runtime shape is fully valid.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      option={option as any}
      height={height}
      onEvents={onEvents}
      className="w-full"
    />
  );
}
