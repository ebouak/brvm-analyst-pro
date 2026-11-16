import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MoyennesMobiles } from '@/components/fiche/MoyennesMobiles';
import type { DatedClose, MovingAverageReading } from '@/lib/movingAverages';
import type { SectorBreadthResult } from '@/lib/movingAverages/server';

const reading: MovingAverageReading = {
  date: '2026-11-13',
  close: 100,
  observations: 50,
  sma20: 98,
  sma50: 95,
  sma200: null,
  distance20Pct: 2.04,
  distance50Pct: 5.26,
  distance200Pct: null,
  slope20Pct: 1.2,
  slope50Pct: 0.8,
  slope200Pct: null,
  regime: 'haussier',
  regimeHorizon: 'court_moyen',
  crossover: null,
};

function render(breadth: SectorBreadthResult, seancesSansCotation = 0): string {
  return renderToStaticMarkup(createElement(MoyennesMobiles, {
    reading,
    points: [],
    breadth,
    secteur: 'Industrie',
    dateDernierCours: '2026-11-13',
    dateSeance: '2026-11-13',
    seancesSansCotation,
  }));
}

function series(length: number): DatedClose[] {
  return Array.from({ length }, (_, index) => ({
    code: 'TEST',
    date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
    close: 100 + index,
  }));
}

describe('MoyennesMobiles', () => {
  it('shows all available averages without inventing a crossover event', () => {
    const fullReading: MovingAverageReading = {
      ...reading,
      sma200: 90,
      distance200Pct: 11.11,
      slope200Pct: 0.4,
      regimeHorizon: 'complet',
    };
    const html = renderToStaticMarkup(createElement(MoyennesMobiles, {
      reading: fullReading,
      points: series(220),
      breadth: { status: 'insufficient', reading: null },
      secteur: 'Industrie',
      dateDernierCours: '2026-11-13',
      dateSeance: '2026-11-13',
      seancesSansCotation: 0,
    }));

    expect(html).toContain('98 FCFA');
    expect(html).toContain('95 FCFA');
    expect(html).toContain('90 FCFA');
    expect(html).not.toContain('Croisement SMA20/SMA50');
  });

  it('explains and plots the last 120 real closes with a neutral position summary', () => {
    const fullReading: MovingAverageReading = {
      ...reading,
      sma200: 90,
      distance200Pct: 11.11,
      slope200Pct: 0.4,
      regimeHorizon: 'complet',
    };
    const html = renderToStaticMarkup(createElement(MoyennesMobiles, {
      reading: fullReading,
      points: series(220),
      breadth: { status: 'insufficient', reading: null },
      secteur: 'Industrie',
      dateDernierCours: '2026-11-13',
      dateSeance: '2026-11-13',
      seancesSansCotation: 0,
    }));

    expect(html).toContain('Cours de clôture');
    expect(html).toContain('Moyenne 20 séances');
    expect(html).toContain('Moyenne 50 séances');
    expect(html).toContain('Moyenne 200 séances');
    expect(html).toContain('120 dernières clôtures');
    expect(html).toContain('Le cours se situe au-dessus');
    expect(html).toContain('ne prédit pas le cours');
    expect(html).toContain('recommandation d');
  });

  it('keeps unavailable averages out of the chart and explains the short history', () => {
    const html = renderToStaticMarkup(createElement(MoyennesMobiles, {
      reading,
      points: series(30),
      breadth: { status: 'insufficient', reading: null },
      secteur: 'Industrie',
      dateDernierCours: '2026-11-13',
      dateSeance: '2026-11-13',
      seancesSansCotation: 0,
    }));

    expect(html).toContain('30 dernières clôtures');
    expect(html).toContain('historique insuffisant');
    expect(html).not.toContain('data-series="sma50"');
    expect(html).not.toContain('data-series="sma200"');
  });

  it('explains unavailable long-term data and insufficient sector context', () => {
    const html = render({ status: 'insufficient', reading: null });

    expect(html).toContain('Moyenne mobile');
    expect(html).toContain('200 clôtures valides nécessaires');
    expect(html).toContain('Aucune clôture valide n');
    expect(html).toContain('Données sectorielles insuffisantes');
    expect(html).toContain('Indicateurs descriptifs, non prédictifs');
  });

  it('renders same-sector breadth with its numerator, denominator, and percentages', () => {
    const html = render({
      status: 'available',
      reading: {
        sma50Above: { above: 2, total: 3, percent: 66.66666666666666 },
        sma200Above: { above: 1, total: 3, percent: 33.33333333333333 },
      },
    });

    expect(html).toContain('2 / 3');
    expect(html).toContain('66,67 %');
    expect(html).toContain('1 / 3');
    expect(html).toContain('33,33 %');
    expect(html).toContain('Industrie');
  });

  it('makes a stale close explicit instead of presenting it as the market session close', () => {
    const html = render({ status: 'insufficient', reading: null }, 2);

    expect(html).toContain('Dernière clôture');
    expect(html).toContain('2 séances sans nouvelle clôture');
  });
});
