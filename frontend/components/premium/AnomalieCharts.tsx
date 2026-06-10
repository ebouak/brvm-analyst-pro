'use client';
import EChart from '@/components/EChart';
import type { PointDividende, PointLiquiditeVol, CellHeatmap, PointValuation } from '@/lib/premium/anomalies';

const SIG_COLOR: Record<string, string> = { BUY: '#00c853', HOLD: '#ffb300', SELL: '#f44336' };
const GRID = { lineStyle: { color: '#232733' } };
const AXIS_LABEL = { color: '#8b93a7' };
const AXIS_NAME = { color: '#8b93a7' };

function ChartCard({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-elevated/60 p-5 mb-6 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-gold/30 shadow-card">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-1 h-8 rounded-full bg-gold/40 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-sm font-semibold text-ivory mb-0.5">{title}</h2>
          <p className="text-xs text-muted">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-gold/20 bg-gold/[0.06] text-gold/60 text-base mb-3">◇</div>
      <p className="text-muted text-sm">Données insuffisantes pour cette analyse.</p>
    </div>
  );
}

export function AnomalieCharts({
  pointsDividendes,
  pointsLiqVol,
  heatmapCells,
  pointsValuation,
}: {
  pointsDividendes: PointDividende[];
  pointsLiqVol: PointLiquiditeVol[];
  heatmapCells: CellHeatmap[];
  pointsValuation: PointValuation[];
}) {
  const divSigMap = new Map(pointsDividendes.map((p) => [p.code, p.signal]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const optDiv: any = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (p: any) =>
        `<b>${p.data[3]}</b> (${p.data[2]})<br/>Rendement : ${p.data[1]}%<br/>Payout : ${p.data[0]}%`,
    },
    xAxis: { name: 'Payout (%)', type: 'value', nameTextStyle: AXIS_NAME, axisLabel: AXIS_LABEL, splitLine: GRID },
    yAxis: { name: 'Rendement (%)', type: 'value', nameTextStyle: AXIS_NAME, axisLabel: AXIS_LABEL, splitLine: GRID },
    series: [{
      type: 'scatter',
      data: pointsDividendes.map((p) => [p.payout, p.rendement, p.code, p.nom]),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      itemStyle: { color: (params: any) => SIG_COLOR[divSigMap.get(params.data[2]) ?? 'HOLD'] ?? '#ffb300' },
      symbolSize: 10,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      label: { show: pointsDividendes.length < 20, formatter: (p: any) => p.data[2], color: '#e6e9f0', fontSize: 9, position: 'top' },
    }],
  };

  const liqSigMap = new Map(pointsLiqVol.map((p) => [p.code, p.signal]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const optLiq: any = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (p: any) =>
        `<b>${p.data[2]}</b><br/>Liquidité : ${(p.data[0] as number).toFixed(1)} M FCFA/j<br/>Volatilité : ${p.data[1]}%`,
    },
    xAxis: { name: 'Liquidité moy. (M FCFA/j)', type: 'value', nameTextStyle: AXIS_NAME, axisLabel: AXIS_LABEL, splitLine: GRID },
    yAxis: { name: 'Volatilité (%)', type: 'value', nameTextStyle: AXIS_NAME, axisLabel: AXIS_LABEL, splitLine: GRID },
    series: [{
      type: 'scatter',
      data: pointsLiqVol.map((p) => [p.liquidite, p.volatilite, p.code]),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      itemStyle: { color: (params: any) => SIG_COLOR[liqSigMap.get(params.data[2]) ?? 'HOLD'] ?? '#ffb300' },
      symbolSize: 10,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      label: { show: true, formatter: (p: any) => p.data[2], color: '#e6e9f0', fontSize: 9, position: 'top' },
    }],
  };

  const codes = [...new Set(heatmapCells.map((c) => c.code))].slice(0, 30);
  const dates = [...new Set(heatmapCells.map((c) => c.date))].sort().slice(-20);
  const heatData = heatmapCells
    .filter((c) => codes.includes(c.code) && dates.includes(c.date))
    .map((c) => [dates.indexOf(c.date), codes.indexOf(c.code), c.variation]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const optHeat: any = {
    backgroundColor: 'transparent',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tooltip: { formatter: (p: any) => `${codes[p.data[1]]} — ${dates[p.data[0]]}<br/>Variation : ${p.data[2]}%` },
    xAxis: { type: 'category', data: dates.map((d) => d.slice(5)), axisLabel: { color: '#8b93a7', fontSize: 8, rotate: 45 }, splitLine: { show: false } },
    yAxis: { type: 'category', data: codes, axisLabel: { color: '#e6e9f0', fontSize: 8 } },
    visualMap: { min: -5, max: 5, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, textStyle: { color: '#8b93a7' }, inRange: { color: ['#f44336', '#232733', '#00c853'] } },
    series: [{ type: 'heatmap', data: heatData, itemStyle: { borderColor: '#0f1117', borderWidth: 1 } }],
  };

  const valSigMap = new Map(pointsValuation.map((p) => [p.code, p.signal]));
  const valData = pointsValuation.filter((p) => p.croissance_ca !== null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const optVal: any = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (p: any) =>
        `<b>${p.data[2]}</b><br/>Marge nette : ${p.data[0]}%<br/>Croissance CA : ${p.data[1]}%`,
    },
    xAxis: { name: 'Marge nette (%)', type: 'value', nameTextStyle: AXIS_NAME, axisLabel: AXIS_LABEL, splitLine: GRID },
    yAxis: { name: 'Croissance CA (%)', type: 'value', nameTextStyle: AXIS_NAME, axisLabel: AXIS_LABEL, splitLine: GRID },
    series: [{
      type: 'scatter',
      data: valData.map((p) => [p.marge_nette, p.croissance_ca, p.code]),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      itemStyle: { color: (params: any) => SIG_COLOR[valSigMap.get(params.data[2]) ?? 'HOLD'] ?? '#ffb300' },
      symbolSize: 10,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      label: { show: true, formatter: (p: any) => p.data[2], color: '#e6e9f0', fontSize: 9, position: 'top' },
    }],
  };

  return (
    <>
      <ChartCard title="Dividendes — Rendement vs Payout" desc="Zone idéale : rendement élevé + payout raisonnable (<80%). Payout élevé = risque de coupe.">
        {pointsDividendes.length === 0 ? <EmptyState /> : <EChart option={optDiv} height={340} />}
      </ChartCard>

      <ChartCard title="Liquidité vs Volatilité" desc="Idéal : forte liquidité, faible volatilité (bas-droit). Haut-gauche = volatile et illiquide.">
        {pointsLiqVol.length === 0 ? <EmptyState /> : <EChart option={optLiq} height={340} />}
      </ChartCard>

      <ChartCard title="Heatmap — 20 dernières séances" desc="Variations journalières. Rouge = baisse, vert = hausse. Lignes homogènes = mouvement de marché.">
        {heatData.length === 0 ? <EmptyState /> : <EChart option={optHeat} height={Math.max(280, codes.length * 18 + 60)} />}
      </ChartCard>

      <ChartCard title="Marge nette vs Croissance CA" desc="Haut-droit = croissance rentable. Les 'ciseaux' (CA croît, marge chute) sont en haut-gauche.">
        {valData.length === 0 ? <EmptyState /> : <EChart option={optVal} height={340} />}
      </ChartCard>
    </>
  );
}
