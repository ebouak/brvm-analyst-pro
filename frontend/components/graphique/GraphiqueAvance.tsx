'use client';
// Graphique avancé des cours (Lightweight Charts, licence Apache 2.0).
//
// Tout chiffre vient de `brvm_actions_daily` / `brvm_indices_daily` : chandeliers
// seulement là où ouverture, plus haut et plus bas existent en base ; ailleurs,
// courbe de clôture, et l'écran le dit. Les indicateurs réutilisent
// `lib/indicators` ; agrégation, Fibonacci, mesure, base 100 et exports sont
// des fonctions pures testées (`lib/graphique`).

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type Time,
  type WhitespaceData,
  type LineData,
  type CandlestickData,
  type HistogramData,
} from 'lightweight-charts';
import { ChartCandlestick, ChartLine, Download, Lock, Maximize2, Minimize2, PencilRuler, SlidersHorizontal, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { bollingerSeries, macdSeries, rsiSeries, smaSeries } from '@/lib/indicators';
import { chartTheme } from '@/lib/chartTheme';
import {
  INTERVALLES,
  PERIODES,
  agreger,
  aOhlc,
  bornesPeriode,
  cleIntervalle,
  normaliserSeances,
  partOhlc,
  periodeCouverte,
  variationPeriode,
  type Barre,
  type Intervalle,
  type LigneCours,
  type Periode,
} from '@/lib/graphique/donnees';
import { dateVersLogique, logiqueVersDate, type Ancre } from '@/lib/graphique/geometrie';
import { alignerSur, base100, ecartFinal, rebaserTout, type Point } from '@/lib/graphique/comparaison';
import { chargerComparables, chargerCours, chargerDessins, chargerSerie, enregistrerDessins, type Comparable } from '@/lib/graphique/chargement';
import { MAX_DESSINS, MAX_TEXTE, deplacerDessin, type Dessin } from '@/lib/graphique/dessins';
import { construireTableau, nomFichier, versCsv, versTxt, versXlsx, type FormatExport } from '@/lib/graphique/exports';
import { fmtDate, fmtEntier, fmtPctSigne, fmtPrix, fmtEcartSigne } from '@/lib/graphique/format';
import BarreDessin, { OUTILS, type Outil } from './BarreDessin';
import CoucheDessins, { type Geo } from './CoucheDessins';

type TypeTrace = 'bougies' | 'ligne';
interface Reglages {
  mm: { actif: boolean; periode: number }[];
  bollinger: boolean;
  rsi: boolean;
  macd: boolean;
  volMoyen: boolean;
}

const REGLAGES_DEFAUT: Reglages = {
  mm: [
    { actif: true, periode: 20 },
    { actif: true, periode: 50 },
    { actif: false, periode: 200 },
  ],
  bollinger: false,
  rsi: false,
  macd: false,
  volMoyen: false,
};

const COULEURS_MM = ['warn', 'accent', 'ivory'] as const;

const btn =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40';
const btnActif = 'border-accent bg-accent/10 text-accent-ink';
const btnRepos = 'border-border text-muted hover:border-accent hover:text-ivory';

function telecharger(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function toLine(dates: string[], valeurs: (number | null)[]): (LineData | WhitespaceData)[] {
  return dates.map((d, i) => (valeurs[i] == null ? { time: d as Time } : { time: d as Time, value: valeurs[i]! }));
}

let compteurId = 0;
const nouvelId = () => `d${Date.now().toString(36)}-${(compteurId++).toString(36)}`;

export interface GraphiqueAvanceProps {
  code: string;
  designation: string | null;
  /** Hauteur du graphique hors plein écran (px). */
  hauteur?: number;
}

export default function GraphiqueAvance({ code, designation, hauteur = 560 }: GraphiqueAvanceProps) {
  const sb = useMemo(() => createClient(), []);
  const [lignes, setLignes] = useState<LigneCours[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [intervalle, setIntervalle] = useState<Intervalle>('jour');
  const [periode, setPeriode] = useState<Periode | null>('1A');
  const [typeTrace, setTypeTrace] = useState<TypeTrace | null>(null);
  const [log, setLog] = useState(false);
  const [reglages, setReglages] = useState<Reglages>(REGLAGES_DEFAUT);
  const [reglagesOuverts, setReglagesOuverts] = useState(false);
  const [outilsOuverts, setOutilsOuverts] = useState(true);
  const [comparables, setComparables] = useState<Comparable[]>([]);
  const [comparee, setComparee] = useState<{ c: Comparable; serie: Point[] } | null>(null);
  const [chargementCmp, setChargementCmp] = useState(false);
  const [dateBase, setDateBase] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [dessins, setDessins] = useState<Dessin[]>([]);
  const [etatSauvegarde, setEtatSauvegarde] = useState<'aucun' | 'en_cours' | 'ok' | 'erreur'>('aucun');
  const [selection, setSelection] = useState<string | null>(null);
  const [outil, setOutil] = useState<Outil>('selection');
  const [couleur, setCouleur] = useState('accent');
  const [epaisseur, setEpaisseur] = useState<1 | 2 | 3>(2);
  const [plage, setPlage] = useState<[number, number] | null>(null);
  const [survol, setSurvol] = useState<number | null>(null);
  const [rev, setRev] = useState(0);
  const [chartRev, setChartRev] = useState(0);
  const [themeRev, setThemeRev] = useState(0);
  const [pleinEcran, setPleinEcran] = useState(false);
  const [texteEnAttente, setTexteEnAttente] = useState<Ancre | null>(null);
  const [texteSaisi, setTexteSaisi] = useState('');
  const [exportEnCours, setExportEnCours] = useState<FormatExport | null>(null);
  const [annonce, setAnnonce] = useState('');

  const cadreRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const prixRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const cmpRefs = useRef<{ a: ISeriesApi<'Line'>; b: ISeriesApi<'Line'> } | null>(null);
  const plageDatesRef = useRef<{ from: string; to: string } | null>(null);
  const periodeRef = useRef<Periode | null>(periode);
  periodeRef.current = periode;
  const dessinsCharges = useRef(false);
  const conteneurRef = useRef<HTMLDivElement>(null);
  // Un déplacement de fenêtre provoqué par le code ne doit pas effacer la période choisie.
  const deplacementProgramme = useRef(false);

  // ── Données ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let vivant = true;
    setLignes(null);
    setErreur(null);
    chargerCours(sb, code)
      .then((l) => vivant && setLignes(l))
      .catch((e: Error) => vivant && setErreur(e.message));
    chargerComparables(sb)
      .then((c) => vivant && setComparables(c.filter((x) => x.code !== code)))
      .catch(() => vivant && setComparables([]));
    sb.auth.getUser().then(({ data }) => vivant && setUserId(data.user?.id ?? null));
    return () => {
      vivant = false;
    };
  }, [sb, code]);

  useEffect(() => {
    dessinsCharges.current = false;
    if (!userId) {
      setEtatSauvegarde('aucun');
      return;
    }
    let vivant = true;
    chargerDessins(sb, userId, code)
      .then((d) => {
        if (!vivant) return;
        setDessins(d);
        dessinsCharges.current = true;
        setEtatSauvegarde('ok');
      })
      .catch(() => vivant && setEtatSauvegarde('erreur'));
    return () => {
      vivant = false;
    };
  }, [sb, userId, code]);

  // Sauvegarde différée : un geste de glisser produit des dizaines d'états.
  useEffect(() => {
    if (!userId || !dessinsCharges.current) return;
    setEtatSauvegarde('en_cours');
    const t = setTimeout(() => {
      enregistrerDessins(sb, userId, code, dessins)
        .then(() => setEtatSauvegarde('ok'))
        .catch(() => setEtatSauvegarde('erreur'));
    }, 800);
    return () => clearTimeout(t);
  }, [sb, userId, code, dessins]);

  const seances = useMemo(() => (lignes ? normaliserSeances(lignes) : []), [lignes]);
  const barres = useMemo(() => agreger(seances, intervalle), [seances, intervalle]);
  const dates = useMemo(() => barres.map((b) => b.date), [barres]);
  const trace: TypeTrace = typeTrace ?? (partOhlc(barres) >= 0.5 ? 'bougies' : 'ligne');
  const modeComparaison = comparee != null;

  // ── Thème (clair / sombre) ────────────────────────────────────────────────
  useEffect(() => {
    const obs = new MutationObserver(() => setThemeRev((r) => r + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const f = () => setThemeRev((r) => r + 1);
    mq.addEventListener('change', f);
    return () => {
      obs.disconnect();
      mq.removeEventListener('change', f);
    };
  }, []);
  const theme = useMemo(() => chartTheme(), [themeRev]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Plein écran ───────────────────────────────────────────────────────────
  useEffect(() => {
    const f = () => setPleinEcran(document.fullscreenElement === cadreRef.current);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);
  const basculerPleinEcran = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void cadreRef.current?.requestFullscreen?.();
  }, []);

  // ── Construction du graphique ─────────────────────────────────────────────
  const appliquerPeriode = useCallback(
    (p: Periode) => {
      const ch = chartRef.current;
      const bornes = bornesPeriode(barres, p);
      if (!ch || !bornes) return;
      deplacementProgramme.current = true;
      ch.timeScale().setVisibleLogicalRange({ from: bornes[0] - 0.5, to: bornes[1] + 0.5 });
    },
    [barres],
  );

  useEffect(() => {
    const el = graphRef.current;
    if (!el || barres.length === 0) return;
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = theme;
    const decimales = barres.some((b) => !Number.isInteger(b.cloture)) ? 2 : 0;
    const ch = createChart(el, {
      autoSize: true,
      layout: {
        background: { color: t.surface },
        textColor: t.muted,
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        fontSize: 11,
        panes: { separatorColor: t.border, enableResize: true },
      },
      grid: { vertLines: { color: t.alpha('border', 0.5) }, horzLines: { color: t.alpha('border', 0.5) } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: t.border,
        mode: modeComparaison ? PriceScaleMode.Normal : log ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: { borderColor: t.border, rightOffset: 4, minBarSpacing: 0.5 },
      localization: {
        locale: 'fr-FR',
        dateFormat: 'dd/MM/yyyy',
        priceFormatter: (p: number) => (modeComparaison ? p.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : fmtPrix(p, decimales)),
      },
      kineticScroll: { mouse: !reduit, touch: !reduit },
    });
    chartRef.current = ch;
    const closes = barres.map((b) => b.cloture);

    // Volumes (panneau des prix, en bas) : couleur selon la clôture précédente.
    const vol = ch.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
    ch.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    vol.setData(
      barres.map((b, i): HistogramData | WhitespaceData =>
        b.volume == null
          ? { time: b.date as Time }
          : { time: b.date as Time, value: b.volume, color: t.alpha(i > 0 && b.cloture < barres[i - 1]!.cloture ? 'down' : 'up', 0.35) },
      ),
    );
    if (reglages.volMoyen && !modeComparaison) {
      const vols = barres.map((b) => b.volume);
      // Moyenne mobile du volume sur 20 barres ; une barre sans volume interrompt la série.
      const moy: (number | null)[] = vols.map((_, i) => {
        if (i < 19) return null;
        const f = vols.slice(i - 19, i + 1);
        return f.some((v) => v == null) ? null : (f as number[]).reduce((a, b2) => a + b2, 0) / 20;
      });
      const s = ch.addSeries(LineSeries, { priceScaleId: 'vol', color: t.warn, lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
      s.setData(toLine(dates, moy));
    }

    if (modeComparaison && comparee) {
      const a = ch.addSeries(LineSeries, { color: t.ivory, lineWidth: 2, title: code, priceLineVisible: false });
      const b = ch.addSeries(LineSeries, { color: t.accent, lineWidth: 2, title: comparee.c.code, priceLineVisible: false });
      cmpRefs.current = { a, b };
      prixRef.current = a;
    } else {
      cmpRefs.current = null;
      if (trace === 'bougies') {
        const c = ch.addSeries(CandlestickSeries, {
          upColor: t.up,
          downColor: t.down,
          borderUpColor: t.up,
          borderDownColor: t.down,
          wickUpColor: t.up,
          wickDownColor: t.down,
          priceLineVisible: false,
        });
        c.setData(
          barres.map((b): CandlestickData | WhitespaceData =>
            aOhlc(b) ? { time: b.date as Time, open: b.ouverture!, high: b.haut!, low: b.bas!, close: b.cloture } : { time: b.date as Time },
          ),
        );
        // Barres sans OHLC : courbe de clôture en pointillés, reliée aux bougies voisines.
        const trou = barres.map((b, i) => !aOhlc(b) || (i > 0 && !aOhlc(barres[i - 1]!)) || (i < barres.length - 1 && !aOhlc(barres[i + 1]!)));
        if (trou.some((x, i) => x && !aOhlc(barres[i]!))) {
          const l = ch.addSeries(LineSeries, { color: t.muted, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
          l.setData(toLine(dates, barres.map((b, i) => (trou[i] ? b.cloture : null))));
        }
        prixRef.current = c;
      } else {
        const l = ch.addSeries(LineSeries, { color: t.ivory, lineWidth: 2, priceLineVisible: false });
        l.setData(barres.map((b) => ({ time: b.date as Time, value: b.cloture })));
        prixRef.current = l;
      }

      reglages.mm.forEach((m, k) => {
        if (!m.actif) return;
        const s = ch.addSeries(LineSeries, { color: t[COULEURS_MM[k]!], lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, title: `MM${m.periode}` });
        s.setData(toLine(dates, smaSeries(closes, m.periode)));
      });
      if (reglages.bollinger) {
        const bb = bollingerSeries(closes, 20, 2);
        for (const [cle, style] of [
          ['upper', LineStyle.Dashed],
          ['middle', LineStyle.Dotted],
          ['lower', LineStyle.Dashed],
        ] as const) {
          const s = ch.addSeries(LineSeries, { color: t.alpha('accent', 0.7), lineWidth: 1, lineStyle: style, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
          s.setData(toLine(dates, bb.map((p) => p[cle])));
        }
      }
      let pane = 1;
      if (reglages.rsi) {
        const s = ch.addSeries(LineSeries, { color: t.accent, lineWidth: 1, priceLineVisible: false, title: 'RSI 14' }, pane);
        s.setData(toLine(dates, rsiSeries(closes, 14)));
        s.createPriceLine({ price: 70, color: t.alpha('down', 0.6), lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: '' });
        s.createPriceLine({ price: 30, color: t.alpha('up', 0.6), lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: '' });
        pane += 1;
      }
      if (reglages.macd) {
        const m = macdSeries(closes);
        const h = ch.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, pane);
        h.setData(barres.map((b, i) => (m[i]!.hist == null ? { time: b.date as Time } : { time: b.date as Time, value: m[i]!.hist!, color: t.alpha(m[i]!.hist! >= 0 ? 'up' : 'down', 0.5) })));
        const l1 = ch.addSeries(LineSeries, { color: t.ivory, lineWidth: 1, priceLineVisible: false, title: 'MACD' }, pane);
        l1.setData(toLine(dates, m.map((p) => p.macd)));
        const l2 = ch.addSeries(LineSeries, { color: t.warn, lineWidth: 1, priceLineVisible: false, title: 'Signal' }, pane);
        l2.setData(toLine(dates, m.map((p) => p.signal)));
        pane += 1;
      }
      const panes = ch.panes();
      if (panes.length > 1) {
        panes[0]!.setStretchFactor(3);
        for (let i = 1; i < panes.length; i++) panes[i]!.setStretchFactor(1);
      }
    }

    // Fenêtre visible : restaure la précédente, sinon la période choisie.
    deplacementProgramme.current = true;
    const prec = plageDatesRef.current;
    if (prec && periodeRef.current == null) {
      const i0 = Math.max(0, dateVersLogique(barres, prec.from, intervalle) ?? 0);
      const i1 = Math.min(barres.length - 1, dateVersLogique(barres, prec.to, intervalle) ?? barres.length - 1);
      ch.timeScale().setVisibleLogicalRange({ from: i0 - 0.5, to: i1 + 0.5 });
    } else {
      const bornes = bornesPeriode(barres, periodeRef.current ?? 'MAX');
      if (bornes) ch.timeScale().setVisibleLogicalRange({ from: bornes[0] - 0.5, to: bornes[1] + 0.5 });
    }

    let cadre = 0;
    const surPlage = () => {
      cancelAnimationFrame(cadre);
      cadre = requestAnimationFrame(() => {
        const r = ch.timeScale().getVisibleLogicalRange();
        if (!r) return;
        const i0 = Math.max(0, Math.ceil(r.from));
        const i1 = Math.min(barres.length - 1, Math.floor(r.to));
        if (i0 > i1) return;
        setPlage([i0, i1]);
        if (!deplacementProgramme.current && periodeRef.current != null) setPeriode(null);
        deplacementProgramme.current = false;
        plageDatesRef.current = { from: barres[i0]!.date, to: barres[i1]!.date };
        setRev((v) => v + 1);
      });
    };
    ch.timeScale().subscribeVisibleLogicalRangeChange(surPlage);
    ch.subscribeCrosshairMove((p) => {
      if (p.logical == null || p.point == null) return setSurvol(null);
      const i = Math.round(p.logical);
      setSurvol(i >= 0 && i < barres.length ? i : null);
    });
    surPlage();
    setChartRev((v) => v + 1);

    return () => {
      cancelAnimationFrame(cadre);
      chartRef.current = null;
      prixRef.current = null;
      cmpRefs.current = null;
      ch.remove();
    };
  }, [barres, dates, trace, log, reglages, modeComparaison, comparee, theme, code, intervalle]);

  // ── Comparaison : base 100 sur la fenêtre affichée ────────────────────────
  const alignee = useMemo(() => {
    if (!comparee) return null;
    return alignerSur(dates, comparee.serie, (a, b) => cleIntervalle(a, intervalle) === cleIntervalle(b, intervalle));
  }, [comparee, dates, intervalle]);

  useEffect(() => {
    if (!comparee || !alignee || !plage) return;
    const t = setTimeout(() => {
      const principale = barres.map((b) => ({ date: b.date, valeur: b.cloture }));
      const r = base100(principale, alignee, barres[plage[0]]!.date, barres[plage[1]]!.date);
      setDateBase(r?.dateBase ?? null);
    }, 150);
    return () => clearTimeout(t);
  }, [comparee, alignee, plage, barres]);

  useEffect(() => {
    const refs = cmpRefs.current;
    if (!refs || !alignee) return;
    if (!dateBase) {
      refs.a.setData([]);
      refs.b.setData([]);
      return;
    }
    const a = rebaserTout(barres.map((b) => ({ date: b.date, valeur: b.cloture })), dateBase) ?? [];
    const b = rebaserTout(alignee, dateBase) ?? [];
    refs.a.setData(a.map((p) => ({ time: p.date as Time, value: p.valeur })));
    refs.b.setData(b.map((p) => ({ time: p.date as Time, value: p.valeur })));
  }, [dateBase, alignee, barres, chartRev]);

  async function choisirComparaison(cle: string) {
    if (!cle) {
      setComparee(null);
      setDateBase(null);
      return;
    }
    const c = comparables.find((x) => x.code === cle);
    if (!c) return;
    setChargementCmp(true);
    try {
      const serie = await chargerSerie(sb, c);
      setComparee({ c, serie });
      setOutil('selection');
      setAnnonce(`Comparaison avec ${c.libelle} en base 100.`);
    } catch {
      setAnnonce('La série de comparaison est indisponible pour le moment.');
    } finally {
      setChargementCmp(false);
    }
  }

  // ── Géométrie des dessins (pixels du panneau des prix) ───────────────────
  const [signature, setSignature] = useState('');
  useEffect(() => {
    let id = 0;
    const boucle = () => {
      const ch = chartRef.current;
      const s = prixRef.current;
      if (ch && s && barres.length) {
        const ref = barres[barres.length - 1]!.cloture;
        const sig = [
          ch.timeScale().width(),
          ch.panes()[0]?.getHeight(),
          ch.timeScale().logicalToCoordinate(0 as never),
          ch.timeScale().logicalToCoordinate(barres.length as never),
          s.priceToCoordinate(ref),
          s.priceToCoordinate(ref * 1.5),
        ].join('|');
        setSignature((prec) => (prec === sig ? prec : sig));
      }
      id = requestAnimationFrame(boucle);
    };
    id = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(id);
  }, [barres]);

  const geo: Geo | null = useMemo(() => {
    void signature;
    void rev;
    const ch = chartRef.current;
    const s = prixRef.current;
    if (!ch || !s || barres.length === 0) return null;
    const ts = ch.timeScale();
    return {
      largeur: ts.width(),
      hauteur: ch.panes()[0]?.getHeight() ?? 0,
      x: (t) => {
        const l = dateVersLogique(barres, t, intervalle);
        return l == null ? null : ts.logicalToCoordinate(l as never);
      },
      y: (p) => s.priceToCoordinate(p),
      ancre: (x, y) => {
        const l = ts.coordinateToLogical(x);
        const p = s.coordinateToPrice(y);
        const t = l == null ? null : logiqueVersDate(barres, l, intervalle);
        return t && p != null && p > 0 ? { t, p } : null;
      },
      logique: (x) => ts.coordinateToLogical(x),
      decaler: (t, n) => {
        const l = dateVersLogique(barres, t, intervalle) ?? 0;
        return logiqueVersDate(barres, Math.max(0, l + n), intervalle) ?? t;
      },
    };
  }, [signature, rev, barres, intervalle]);

  const couleursDessin = useMemo(
    () => ({ accent: theme.accent, warn: theme.warn, up: theme.up, down: theme.down, ivory: theme.ivory, surface: theme.surface }),
    [theme],
  );

  // ── Clavier ───────────────────────────────────────────────────────────────
  function surClavier(e: React.KeyboardEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    const ch = chartRef.current;
    if (e.key === 'Escape') {
      setOutil('selection');
      setSelection(null);
      setTexteEnAttente(null);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
      e.preventDefault();
      supprimerSelection();
      return;
    }
    if (selection && geo && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      const dl = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      const f = e.key === 'ArrowUp' ? 1.005 : e.key === 'ArrowDown' ? 0.995 : 1;
      setDessins((ds) => ds.map((d) => (d.id === selection ? deplacerDessin(d, (t) => geo.decaler(t, dl), f) : d)));
      return;
    }
    if (!ch) return;
    const ts = ch.timeScale();
    const r = ts.getVisibleLogicalRange();
    if (!r) return;
    const largeur = r.to - r.from;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const pas = Math.max(1, Math.round(largeur / 10)) * (e.key === 'ArrowLeft' ? -1 : 1);
      ts.setVisibleLogicalRange({ from: r.from + pas, to: r.to + pas });
      setPeriode(null);
    } else if (e.key === '+' || e.key === '=' || e.key === '-') {
      e.preventDefault();
      const k = e.key === '-' ? 1.25 : 0.8;
      const centre = (r.from + r.to) / 2;
      ts.setVisibleLogicalRange({ from: centre - (largeur * k) / 2, to: centre + (largeur * k) / 2 });
      setPeriode(null);
    } else if (!e.ctrlKey && !e.metaKey && !e.altKey && !modeComparaison) {
      const o = OUTILS.find((x) => x.raccourci.toLowerCase() === e.key.toLowerCase());
      if (o) setOutil(o.cle);
    }
  }

  function supprimerSelection() {
    if (!selection) return;
    setDessins((ds) => ds.filter((d) => d.id !== selection));
    setSelection(null);
    setAnnonce('Dessin supprimé.');
  }

  function ajouterDessins(d: Dessin[]) {
    if (d.length > MAX_DESSINS) {
      setAnnonce(`Limite de ${MAX_DESSINS} dessins atteinte pour cette valeur.`);
      return;
    }
    setDessins(d);
    if (outil !== 'selection' && d.length > dessins.length) {
      setOutil('selection');
      setAnnonce('Dessin ajouté. Outil Sélection réactivé.');
    }
  }

  function validerTexte() {
    const t = texteSaisi.trim().slice(0, MAX_TEXTE);
    if (texteEnAttente && t) {
      const d: Dessin = { id: nouvelId(), type: 'texte', a: texteEnAttente, texte: t, couleur, epaisseur };
      ajouterDessins([...dessins, d]);
      setSelection(d.id);
    }
    setTexteEnAttente(null);
    setTexteSaisi('');
  }

  // ── Exports ───────────────────────────────────────────────────────────────
  async function exporter(format: FormatExport) {
    if (!plage || !userId) return;
    setExportEnCours(format);
    try {
      const lignesVisibles = barres.slice(plage[0], plage[1] + 1);
      const meta = { code, designation, intervalle, extraitLe: new Date() };
      const t = construireTableau(lignesVisibles, meta);
      const nom = nomFichier(t, meta, format);
      if (format === 'csv') telecharger(new Blob([versCsv(t)], { type: 'text/csv;charset=utf-8' }), nom);
      else if (format === 'txt') telecharger(new Blob([versTxt(t)], { type: 'text/plain;charset=utf-8' }), nom);
      else if (format === 'xlsx')
        telecharger(new Blob([await versXlsx(t)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nom);
      else {
        const image = await captureGraphique();
        const { versPdf } = await import('@/lib/graphique/pdf');
        telecharger(await versPdf(t, image), nom);
      }
      setAnnonce(`Export ${format.toUpperCase()} prêt : ${t.lignes.length} lignes.`);
    } catch {
      setAnnonce("L'export a échoué. Réessayez.");
    } finally {
      setExportEnCours(null);
    }
  }

  /** Capture du graphique, dessins compris (la couche SVG est peinte par-dessus). */
  async function captureGraphique(): Promise<string | null> {
    const ch = chartRef.current;
    if (!ch) return null;
    const canvas = ch.takeScreenshot();
    const svg = conteneurRef.current?.querySelector('svg[data-couche-dessins]');
    if (svg && !modeComparaison && dessins.length > 0) {
      try {
        const xml = new XMLSerializer().serializeToString(svg);
        const img = new Image();
        const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
        await new Promise<void>((ok, ko) => {
          img.onload = () => ok();
          img.onerror = () => ko(new Error('svg'));
          img.src = url;
        });
        const k = canvas.width / (graphRef.current?.clientWidth || canvas.width);
        canvas.getContext('2d')?.drawImage(img, 0, 0, img.width * k, img.height * k);
        URL.revokeObjectURL(url);
      } catch {
        // Sans la couche de dessins, l'image reste celle du graphique.
      }
    }
    return canvas.toDataURL('image/png');
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  if (erreur) {
    return (
      <div role="alert" className="rounded-panel border border-border bg-surface p-6 text-sm text-muted">
        Les cours de {code} sont momentanément indisponibles. Réessayez dans un instant.
      </div>
    );
  }
  if (lignes == null) {
    return (
      <div className="grid place-items-center rounded-panel border border-border bg-surface text-sm text-muted" style={{ height: hauteur }} aria-busy>
        Chargement de l’historique de {code}…
      </div>
    );
  }
  if (barres.length < 2) {
    return (
      <div className="rounded-panel border border-border bg-surface p-6 text-sm text-muted">
        Pas assez de séances cotées en base pour tracer un graphique de {code}.
      </div>
    );
  }

  const premiere = seances[0]!.date;
  const derniere = seances[seances.length - 1]!.date;
  const var_ = plage ? variationPeriode(barres, plage[0], plage[1]) : null;
  const barreLegende: Barre | null = survol != null ? barres[survol] ?? null : plage ? barres[plage[1]] ?? null : null;
  const sansOhlcVisibles = plage ? barres.slice(plage[0], plage[1] + 1).filter((b) => !aOhlc(b)).length : 0;
  const nbVisibles = plage ? plage[1] - plage[0] + 1 : 0;
  const cmpEcart = (() => {
    if (!comparee || !alignee || !dateBase || !plage) return null;
    const principale = barres.slice(0, plage[1] + 1).map((b) => ({ date: b.date, valeur: b.cloture }));
    const r = base100(principale, alignee, dateBase, barres[plage[1]]!.date);
    return r ? ecartFinal(r) : null;
  })();
  const premiereCmp = comparee?.serie[0]?.date ?? null;
  const urlRetour = `/login?next=${encodeURIComponent(`/actions/${code}/graphique`)}`;

  return (
    <div
      ref={cadreRef}
      className={`flex flex-col gap-3 ${pleinEcran ? 'h-screen overflow-auto bg-surface p-3' : ''}`}
      onKeyDown={surClavier}
    >
      <p className="sr-only" aria-live="polite">
        {annonce}
      </p>

      {/* Ligne 1 : intervalles, périodes, type, échelle, plein écran */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Intervalle des barres" className="flex gap-1">
          {INTERVALLES.map((i) => (
            <button key={i.cle} type="button" aria-pressed={intervalle === i.cle} onClick={() => setIntervalle(i.cle)} className={`${btn} ${intervalle === i.cle ? btnActif : btnRepos}`}>
              {i.libelle}
            </button>
          ))}
        </div>
        <span className="h-6 w-px bg-border" aria-hidden />
        <div role="group" aria-label="Période affichée" className="flex flex-wrap gap-1">
          {PERIODES.map((p) => {
            const couverte = periodeCouverte(premiere, derniere, p.cle);
            return (
              <button
                key={p.cle}
                type="button"
                aria-pressed={periode === p.cle}
                disabled={!couverte}
                title={couverte ? `Afficher ${p.libelle}` : `Historique disponible depuis le ${fmtDate(premiere)} seulement`}
                onClick={() => {
                  setPeriode(p.cle);
                  appliquerPeriode(p.cle);
                }}
                className={`${btn} tabular ${periode === p.cle ? btnActif : btnRepos}`}
              >
                {p.libelle}
              </button>
            );
          })}
        </div>
        <span className="h-6 w-px bg-border" aria-hidden />
        <div role="group" aria-label="Type de tracé" className="flex gap-1">
          <button type="button" aria-pressed={trace === 'bougies'} disabled={modeComparaison} onClick={() => setTypeTrace('bougies')} className={`${btn} ${trace === 'bougies' && !modeComparaison ? btnActif : btnRepos}`} aria-label="Chandeliers" title="Chandeliers">
            <ChartCandlestick size={16} strokeWidth={1.75} aria-hidden />
          </button>
          <button type="button" aria-pressed={trace === 'ligne'} disabled={modeComparaison} onClick={() => setTypeTrace('ligne')} className={`${btn} ${trace === 'ligne' && !modeComparaison ? btnActif : btnRepos}`} aria-label="Courbe de clôture" title="Courbe de clôture">
            <ChartLine size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <button type="button" aria-pressed={log} disabled={modeComparaison} onClick={() => setLog((v) => !v)} className={`${btn} ${log && !modeComparaison ? btnActif : btnRepos}`} title="Échelle logarithmique">
          Log
        </button>
        <button type="button" aria-expanded={reglagesOuverts} onClick={() => setReglagesOuverts((v) => !v)} className={`${btn} ${reglagesOuverts ? btnActif : btnRepos}`}>
          <SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden /> Indicateurs
        </button>
        <button type="button" aria-expanded={outilsOuverts} onClick={() => setOutilsOuverts((v) => !v)} className={`${btn} ${outilsOuverts ? btnActif : btnRepos}`}>
          <PencilRuler size={16} strokeWidth={1.75} aria-hidden /> Dessins
        </button>
        <button type="button" onClick={basculerPleinEcran} className={`${btn} ${btnRepos} ml-auto`} aria-label={pleinEcran ? 'Quitter le plein écran' : 'Plein écran'} title={pleinEcran ? 'Quitter le plein écran' : 'Plein écran'}>
          {pleinEcran ? <Minimize2 size={16} strokeWidth={1.75} aria-hidden /> : <Maximize2 size={16} strokeWidth={1.75} aria-hidden />}
        </button>
      </div>

      {/* Indicateurs et comparaison */}
      {reglagesOuverts && (
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3 rounded-lg border border-border bg-surface p-3 text-xs text-muted">
          <fieldset className="flex flex-wrap items-center gap-3" disabled={modeComparaison}>
            <legend className="sr-only">Moyennes mobiles</legend>
            {reglages.mm.map((m, k) => (
              <label key={k} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={m.actif}
                  onChange={(e) => setReglages((r) => ({ ...r, mm: r.mm.map((x, j) => (j === k ? { ...x, actif: e.target.checked } : x)) }))}
                  className="accent-accent"
                />
                <span>MM</span>
                <input
                  type="number"
                  min={2}
                  max={400}
                  value={m.periode}
                  aria-label={`Période de la moyenne mobile ${k + 1}`}
                  onChange={(e) => {
                    const v = Math.max(2, Math.min(400, Math.round(Number(e.target.value) || 2)));
                    setReglages((r) => ({ ...r, mm: r.mm.map((x, j) => (j === k ? { ...x, periode: v } : x)) }));
                  }}
                  className="tabular h-8 w-16 rounded-md border border-border bg-surface px-1.5 text-ivory"
                />
              </label>
            ))}
            {(
              [
                ['bollinger', 'Bollinger 20, 2'],
                ['rsi', 'RSI 14'],
                ['macd', 'MACD 12, 26, 9'],
                ['volMoyen', 'Volume moyen 20'],
              ] as const
            ).map(([cle, lib]) => (
              <label key={cle} className="flex items-center gap-1.5">
                <input type="checkbox" checked={reglages[cle]} onChange={(e) => setReglages((r) => ({ ...r, [cle]: e.target.checked }))} className="accent-accent" />
                {lib}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1">
            <span>Comparer en base 100</span>
            <select
              value={comparee?.c.code ?? ''}
              disabled={chargementCmp}
              onChange={(e) => void choisirComparaison(e.target.value)}
              className="h-9 min-w-[220px] max-w-full rounded-md border border-border bg-surface px-2 text-ivory"
            >
              <option value="">Aucune comparaison</option>
              <optgroup label="Indices">
                {comparables.filter((c) => c.type === 'indice').map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.libelle}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Actions">
                {comparables.filter((c) => c.type === 'action').map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.libelle}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          {modeComparaison && (
            <p className="basis-full text-xs text-muted">
              En comparaison, les deux séries sont rebasées à 100 sur la première séance commune de la fenêtre affichée ; indicateurs et dessins sont masqués (ils restent enregistrés).
              {premiereCmp && premiereCmp > premiere ? ` ${comparee!.c.libelle} n’est en base que depuis le ${fmtDate(premiereCmp)}.` : ''}
            </p>
          )}
        </div>
      )}

      {/* Outils de dessin */}
      {outilsOuverts && (
        <div className="flex flex-wrap items-center gap-3">
          <BarreDessin
            outil={outil}
            onOutil={(o) => {
              setOutil(o);
              setSelection(null);
            }}
            couleur={couleur}
            onCouleur={(c) => {
              setCouleur(c);
              if (selection) setDessins((ds) => ds.map((d) => (d.id === selection ? { ...d, couleur: c } : d)));
            }}
            epaisseur={epaisseur}
            onEpaisseur={(e) => {
              setEpaisseur(e);
              if (selection) setDessins((ds) => ds.map((d) => (d.id === selection ? { ...d, epaisseur: e } : d)));
            }}
            aSelection={selection != null}
            onSupprimer={supprimerSelection}
            nbDessins={dessins.length}
            onToutEffacer={() => {
              if (window.confirm(`Effacer les ${dessins.length} dessins de ${code} ?`)) {
                setDessins([]);
                setSelection(null);
              }
            }}
            desactive={modeComparaison}
            raisonDesactive="Les dessins sont masqués pendant une comparaison"
          />
          <p className="text-xs text-muted">
            {userId === null ? (
              <>
                Vos dessins restent sur cette page tant qu’elle est ouverte.{' '}
                <Link href={urlRetour} className="text-accent-ink underline-offset-2 hover:underline">
                  Connectez-vous pour les retrouver
                </Link>
                .
              </>
            ) : etatSauvegarde === 'erreur' ? (
              'Enregistrement des dessins indisponible : ils restent sur cette page.'
            ) : etatSauvegarde === 'en_cours' ? (
              'Enregistrement…'
            ) : etatSauvegarde === 'ok' ? (
              'Dessins enregistrés sur votre compte.'
            ) : null}
          </p>
        </div>
      )}

      {/* Légende de la barre survolée et variation de la fenêtre */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-muted" aria-live="off">
        {barreLegende && !modeComparaison && (
          <span className="tabular">
            <span className="text-ivory">{fmtDate(barreLegende.date)}</span>
            {barreLegende.nbSeances > 1 ? ` (${barreLegende.nbSeances} séances)` : ''}
            {aOhlc(barreLegende) ? ` · O ${fmtPrix(barreLegende.ouverture)} · H ${fmtPrix(barreLegende.haut)} · B ${fmtPrix(barreLegende.bas)}` : ''}
            {' · C '}
            <span className="text-ivory">{fmtPrix(barreLegende.cloture)}</span>
            {barreLegende.variationPct != null ? (
              <span className={barreLegende.variationPct >= 0 ? 'text-up' : 'text-down'}> {fmtPctSigne(barreLegende.variationPct)}</span>
            ) : null}
            {barreLegende.volume != null ? ` · Vol. ${fmtEntier(barreLegende.volume)}` : ''}
          </span>
        )}
        {var_ && !modeComparaison && (
          <span className="tabular">
            Sur la période affichée ({fmtDate(var_.debut)} → {fmtDate(var_.fin)}) :{' '}
            <span className={var_.ecart >= 0 ? 'text-up' : 'text-down'}>
              {fmtEcartSigne(var_.ecart)} FCFA ({fmtPctSigne(var_.ecartPct)})
            </span>
          </span>
        )}
        {modeComparaison && cmpEcart && dateBase && (
          <span className="tabular">
            Base 100 au {fmtDate(dateBase)} · au {fmtDate(cmpEcart.date)} : <span className="text-ivory">{code} {cmpEcart.principale.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</span>
            {' · '}
            <span className="text-accent-ink">
              {comparee!.c.libelle} {cmpEcart.comparee.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
            </span>
          </span>
        )}
        {modeComparaison && !dateBase && <span>Aucune séance commune avec {comparee!.c.libelle} sur la fenêtre affichée.</span>}
      </div>

      {/* Graphique */}
      <div
        ref={conteneurRef}
        className="relative w-full overflow-hidden rounded-lg border border-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        style={{ height: pleinEcran ? 'calc(100vh - 230px)' : `min(${hauteur}px, 68vh)`, minHeight: 320 }}
        tabIndex={0}
        role="application"
        aria-roledescription="graphique de cours"
        aria-label={`Graphique de ${designation ?? code}. Flèches gauche et droite : défiler ; plus et moins : zoomer ; lettres H, T, S, R, F, A, M : outils de dessin ; Échap : annuler ; Suppr : supprimer le dessin sélectionné.`}
        aria-describedby="graphique-resume"
      >
        <div ref={graphRef} className="absolute inset-0" />
        {geo && !modeComparaison && (
            <div className="pointer-events-none absolute inset-0 z-10">
              <CoucheDessins
                geo={geo}
                dessins={dessins}
                onChange={ajouterDessins}
                outil={outil}
                couleur={couleur}
                epaisseur={epaisseur}
                selection={selection}
                onSelection={setSelection}
                couleurs={couleursDessin}
                seances={seances}
                onTexte={(a) => {
                  setTexteEnAttente(a);
                  setTexteSaisi('');
                }}
                nouvelId={nouvelId}
              />
            </div>
        )}
        {texteEnAttente && geo && (
          <form
            className="absolute z-20 flex items-center gap-1 rounded-md border border-border bg-surface p-1.5 shadow-card"
            style={{ left: Math.min(Math.max(4, geo.x(texteEnAttente.t) ?? 4), Math.max(4, geo.largeur - 260)), top: Math.max(4, (geo.y(texteEnAttente.p) ?? 20) - 18) }}
            onSubmit={(e) => {
              e.preventDefault();
              validerTexte();
            }}
          >
            <input
              autoFocus
              value={texteSaisi}
              maxLength={MAX_TEXTE}
              onChange={(e) => setTexteSaisi(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setTexteEnAttente(null)}
              aria-label="Texte de l'annotation"
              placeholder="Annotation"
              className="h-8 w-44 rounded border border-border bg-surface px-2 text-xs text-ivory"
            />
            <button type="submit" className={`${btn} ${btnActif} h-8`}>
              Ajouter
            </button>
            <button type="button" onClick={() => setTexteEnAttente(null)} className={`${btn} ${btnRepos} h-8`} aria-label="Annuler l'annotation">
              <X size={14} aria-hidden />
            </button>
          </form>
        )}
      </div>

      <p id="graphique-resume" className="text-xs text-muted">
        {trace === 'bougies' && !modeComparaison && sansOhlcVisibles > 0
          ? `Ouverture, plus haut et plus bas absents en base sur ${sansOhlcVisibles} des ${nbVisibles} barres affichées : ces barres sont tracées en courbe de clôture (pointillés). `
          : ''}
        {trace === 'ligne' && !modeComparaison && partOhlc(barres) < 0.5 ? 'Ouverture, plus haut et plus bas manquent sur la plupart des séances en base : courbe de clôture. ' : ''}
        Historique en base : {seances.length.toLocaleString('fr-FR')} séances, du {fmtDate(premiere)} au {fmtDate(derniere)}.
      </p>

      {/* Exports */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <Download size={14} strokeWidth={1.75} aria-hidden /> Exporter la période affichée
        </span>
        {userId ? (
          (['csv', 'xlsx', 'txt', 'pdf'] as const).map((f) => (
            <button key={f} type="button" disabled={exportEnCours != null || !plage} onClick={() => void exporter(f)} aria-busy={exportEnCours === f} className={`${btn} ${btnRepos}`}>
              {exportEnCours === f ? 'Préparation…' : f === 'xlsx' ? 'Excel (XLSX)' : f.toUpperCase()}
            </button>
          ))
        ) : userId === null ? (
          <Link href={urlRetour} className={`${btn} ${btnRepos}`}>
            <Lock size={14} strokeWidth={1.75} aria-hidden /> Connectez-vous pour exporter (CSV, Excel, TXT, PDF)
          </Link>
        ) : null}
        {plage && <span className="tabular text-xs text-faint">{nbVisibles.toLocaleString('fr-FR')} lignes</span>}
      </div>
    </div>
  );
}
