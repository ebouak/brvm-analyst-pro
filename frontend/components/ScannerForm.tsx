'use client';

import Link from 'next/link';
import type { ScannerCriteria } from '@/lib/scanner';

interface Props {
  criteria: ScannerCriteria;
  secteurs: string[];
}

export default function ScannerForm({ criteria, secteurs }: Props) {
  return (
    <form method="GET" action="/scanner" className="bg-surface border border-border rounded-xl p-5 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

        {/* Signal */}
        <div className="flex flex-col gap-1">
          <label htmlFor="sc-signal" className="text-xs text-muted">Signal</label>
          <select id="sc-signal" name="signal" defaultValue={criteria.signal ?? ''} className="select-field">
            <option value="">Tous</option>
            <option value="BUY">Signal haussier</option>
            <option value="HOLD">Neutre</option>
            <option value="SELL">Signal baissier</option>
          </select>
        </div>

        {/* RSI */}
        <div className="flex flex-col gap-1">
          <label htmlFor="sc-rsiBucket" className="text-xs text-muted">RSI</label>
          <select id="sc-rsiBucket" name="rsiBucket" defaultValue={criteria.rsiBucket ?? ''} className="select-field">
            <option value="">Tous</option>
            <option value="oversold">{'< 30 (survendu)'}</option>
            <option value="low">30 – 50</option>
            <option value="mid">50 – 70</option>
            <option value="overbought">{'> 70 (suracheté)'}</option>
          </select>
        </div>

        {/* Tendance MA */}
        <div className="flex flex-col gap-1">
          <label htmlFor="sc-maTrend" className="text-xs text-muted">Tendance MA</label>
          <select id="sc-maTrend" name="maTrend" defaultValue={criteria.maTrend ?? ''} className="select-field">
            <option value="">Aucune</option>
            <option value="above_ma20">Prix {'>'} MA20</option>
            <option value="above_ma50">Prix {'>'} MA50</option>
            <option value="above_ma200">Prix {'>'} MA200</option>
            <option value="above_ma20_50">Prix {'>'} MA20 ET MA50</option>
          </select>
        </div>

        {/* MACD */}
        <div className="flex flex-col gap-1">
          <label htmlFor="sc-macdDir" className="text-xs text-muted">MACD</label>
          <select id="sc-macdDir" name="macdDir" defaultValue={criteria.macdDir ?? ''} className="select-field">
            <option value="">Tous</option>
            <option value="bullish">Bullish (MACD {'>'} Signal)</option>
            <option value="bearish">Bearish (MACD {'<'} Signal)</option>
          </select>
        </div>

        {/* Volume */}
        <div className="flex flex-col gap-1">
          <label htmlFor="sc-volumeRatio" className="text-xs text-muted">Volume</label>
          <select id="sc-volumeRatio" name="volumeRatio" defaultValue={criteria.volumeRatio != null ? String(criteria.volumeRatio) : ''} className="select-field">
            <option value="">Tous</option>
            <option value="2">{'> 2× moyenne 20j'}</option>
            <option value="5">{'> 5× moyenne 20j'}</option>
          </select>
        </div>

        {/* Variation */}
        <div className="flex flex-col gap-1">
          <label htmlFor="sc-variationDir" className="text-xs text-muted">Variation jour</label>
          <select id="sc-variationDir" name="variationDir" defaultValue={criteria.variationDir ?? ''} className="select-field">
            <option value="">Tous</option>
            <option value="up_2">Hausse {'>'} 2%</option>
            <option value="up_5">Hausse {'>'} 5%</option>
            <option value="down_2">Baisse {'>'} 2%</option>
            <option value="down_5">Baisse {'>'} 5%</option>
          </select>
        </div>

        {/* Secteur */}
        <div className="flex flex-col gap-1">
          <label htmlFor="sc-secteur" className="text-xs text-muted">Secteur</label>
          <select id="sc-secteur" name="secteur" defaultValue={criteria.secteur ?? ''} className="select-field">
            <option value="">Tous les secteurs</option>
            {secteurs.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Boutons */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          className="px-5 py-2 rounded-lg bg-up text-obsidian font-semibold text-sm hover:bg-up/80 transition-colors"
        >
          Lancer le scan
        </button>
        <Link
          href="/scanner"
          className="px-5 py-2 rounded-lg border border-border text-sm text-muted hover:text-white transition-colors"
        >
          Réinitialiser
        </Link>
      </div>
    </form>
  );
}
