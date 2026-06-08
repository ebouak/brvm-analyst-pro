'use client';

import { useEffect, useState } from 'react';
import { readPdf } from '@/lib/import/pdfClient';
import { validateExtraction, type FundamentalExtraction } from '@/lib/import/validate';
import { readJsonResponse } from '@/lib/import/fetchJson';
import FundamentalReview from './FundamentalReview';

type Status = 'pending' | 'reading' | 'analyzing' | 'auto-saving' | 'review' | 'done' | 'error';

interface Props {
  file: File;
  validCodes: Set<string>;
}

function parseName(name: string): { symbol: string; year: number } {
  const stem = name.replace(/\.[^.]+$/, '');
  const yearM = stem.match(/(20\d{2})/);
  const year = yearM ? Number(yearM[1]) : new Date().getFullYear() - 1;

  // Format fiable uniquement : SYMBOLE_ANNEE.pdf ou SYMBOLE.pdf
  const exact = stem.match(/^([A-Za-z]{2,6})(?:_\d{4})?$/);
  if (exact) return { symbol: exact[1]!.toUpperCase(), year };

  // Sinon : champ vide → l'utilisateur saisit le code manuellement
  return { symbol: '', year };
}

const M = 1_000_000;

export default function ImportRow({ file, validCodes }: Props) {
  const parsed = parseName(file.name);
  const [symbol, setSymbol] = useState(parsed.symbol);
  const [year, setYear] = useState(parsed.year);
  const [status, setStatus] = useState<Status>('pending');
  const [provider, setProvider] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<FundamentalExtraction | null>(null);
  const [suspects, setSuspects] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    if (!validCodes.has(symbol)) { setStatus('error'); setError(`Code ${symbol} inconnu — corrigez-le.`); return; }
    try {
      setStatus('reading');
      const pdf = await readPdf(file);
      setStatus('analyzing');
      const res = await fetch('/api/extract-llm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: pdf.mode, symbol, year, text: pdf.text, images: pdf.images }),
      });
      const j = await readJsonResponse(res);
      if (!j.ok) { setStatus('error'); setError((j.data.error as string) ?? 'Échec analyse'); return; }
      setProvider(j.data.provider as string);
      const data = j.data.data as FundamentalExtraction;
      setExtraction(data);
      const v = validateExtraction(data);
      setSuspects(v.suspects);
      if (v.status === 'auto') {
        setStatus('auto-saving');
        const w = await fetch('/api/fundamentals', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: symbol, year,
            revenue:           data.revenue != null   ? Math.round(data.revenue * M)    : null,
            net_income:        data.net_income != null ? Math.round(data.net_income * M) : null,
            equity:            data.equity != null     ? Math.round(data.equity * M)     : null,
            debt:              data.debt_total != null ? Math.round(data.debt_total * M) : null,
            shares:            data.shares_outstanding ?? null,
            eps:               data.eps ?? null,
            dividend_per_share: data.dividend_per_share ?? null,
          }),
        });
        const wj = await readJsonResponse(w);
        if (!wj.ok) { setStatus('error'); setError((wj.data.error as string) ?? 'Échec écriture'); return; }
        setStatus('done');
      } else {
        setStatus('review');
      }
    } catch (e) {
      setStatus('error'); setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  // Ne pas auto-lancer : l'utilisateur valide d'abord le symbole détecté
  useEffect(() => {
    // Auto-lancer uniquement si le symbole parsé semble fiable (format SYMBOLE_ANNEE exact)
    const stem = file.name.replace(/\.[^.]+$/, '');
    if (/^[A-Z]{2,6}_20\d{2}$/i.test(stem)) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-surface border border-border rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-3 text-sm">
        <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="CODE"
          className="w-20 bg-bg border border-border rounded px-2 py-1 text-sm font-medium uppercase" />
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
          placeholder="Année" title="Année de l'exercice"
          className="w-20 bg-bg border border-border rounded px-2 py-1 text-sm" />
        <span className="text-muted text-xs truncate flex-1">{file.name}</span>
        <span className="text-xs">
          {status === 'pending' && <span className="text-faint">en attente</span>}
          {status === 'reading' && '📄 lecture…'}
          {status === 'analyzing' && '🤖 analyse…'}
          {status === 'auto-saving' && '💾 écriture…'}
          {status === 'done' && <span className="text-up">✓ enregistré ({provider})</span>}
          {status === 'review' && <span className="text-warn">⚠️ à valider ({provider})</span>}
          {status === 'error' && <span className="text-down">✕ {error}</span>}
        </span>
        {status === 'pending' && (
          <button type="button" onClick={() => void run()} disabled={!symbol.trim()}
            className="text-xs px-2 py-1 rounded bg-up text-bg font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            Analyser
          </button>
        )}
        {(status === 'error') && (
          <button type="button" onClick={() => { setStatus('pending'); setError(null); }}
            className="text-xs text-up hover:underline">Corriger</button>
        )}
      </div>
      {status === 'review' && extraction && (
        <FundamentalReview symbol={symbol} year={year} initial={extraction} suspects={suspects} onSaved={() => setStatus('done')} />
      )}
    </div>
  );
}
