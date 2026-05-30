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
          <label className="text-xs text-muted uppercase tracking-wider">Signal</label>
          <select name="signal" defaultValue={criteria.signal ?? ''} className="select-field">
            <option value="">Tous</option>
            <option value="BUY">BUY</option>
            <option value="HOLD">HOLD</option>
            <option value="SELL">SELL</option>
          </select>
        </div>

        {/* RSI */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted uppercase tracking-wider">RSI</label>
          <select name="rsiBucket" defaultValue={criteria.rsiBucket ?? ''} className="select-field">
            <option value="">Tous</option>
            <option value="oversold">{'< 30 (survendu)'}</option>
            <option value="low">30 – 50</option>
            <option value="mid">50 – 70</option>
            <option value="overbought">{'> 70 (suracheté)'}</option>
          </select>
        </div>

        {/* Tendance MA */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted uppercase tracking-wider">Tendance MA</label>
          <select name="maTrend" defaultValue={criteria.maTrend ?? ''} className="select-field">
            <option value="">Aucune</option>
            <option value="above_ma20">Prix {'>'} MA20</option>
            <option value="above_ma50">Prix {'>'} MA50</option>
            <option value="above_ma200">Prix {'>'} MA200</option>
            <option value="above_ma20_50">Prix {'>'} MA20 ET MA50</option>
          </select>
        </div>

        {/* MACD */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted uppercase tracking-wider">MACD</label>
          <select name="macdDir" defaultValue={criteria.macdDir ?? ''} className="select-field">
            <option value="">Tous</option>
            <option value="bullish">Bullish (MACD {'>'} Signal)</option>
            <option value="bearish">Bearish (MACD {'<'} Signal)</option>
          </select>
        </div>

        {/* Volume */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted uppercase tracking-wider">Volume</label>
          <select name="volumeRatio" defaultValue={criteria.volumeRatio != null ? String(criteria.volumeRatio) : ''} className="select-field">
            <option value="">Tous</option>
            <option value="2">{'> 2× moyenne 20j'}</option>
            <option value="5">{'> 5× moyenne 20j'}</option>
          </select>
        </div>

        {/* Variation */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted uppercase tracking-wider">Variation jour</label>
          <select name="variationDir" defaultValue={criteria.variationDir ?? ''} className="select-field">
            <option value="">Tous</option>
            <option value="up_2">Hausse {'>'} 2%</option>
            <option value="up_5">Hausse {'>'} 5%</option>
            <option value="down_2">Baisse {'>'} 2%</option>
            <option value="down_5">Baisse {'>'} 5%</option>
          </select>
        </div>

        {/* Secteur */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted uppercase tracking-wider">Secteur</label>
          <select name="secteur" defaultValue={criteria.secteur ?? ''} className="select-field">
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
          className="px-5 py-2 rounded-lg bg-up text-black font-semibold text-sm hover:bg-up/80 transition-colors"
        >
          Lancer le scan →
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
