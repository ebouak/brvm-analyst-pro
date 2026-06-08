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

  // Année : premier "20XX" trouvé dans le nom
  const yearM = stem.match(/(20\d{2})/);
  const year = yearM ? Number(yearM[1]) : new Date().getFullYear() - 1;

  // Format 1 : SYMBOLE_ANNEE  (ex. PALC_2025)
  const fmt1 = stem.match(/^([A-Z]{2,6})_\d{4}/i);
  if (fmt1) return { symbol: fmt1[1]!.toUpperCase(), year };

  // Format 2 : contient un code BRVM connu en majuscules (2-6 lettres capitales)
  //            isolé par séparateurs (espace, tiret, underscore, point)
  const codes = stem.match(/(?:^|[\s\-_.])([A-Z]{2,6})(?:[\s\-_.]|$)/g);
  if (codes) {
    // Prendre le dernier token qui ressemble à un code (ignore mots courants)
    const IGNORE = new Set(['PDF', 'CI', 'SA', 'SAS', 'NV', 'AG', 'AN', 'DU', 'DE', 'LA', 'ET']);
    for (const raw of [...codes].reverse()) {
      const tok = raw.replace(/[\s\-_.]/g, '').toUpperCase();
      if (tok.length >= 2 && tok.length <= 6 && !IGNORE.has(tok) && !/^\d+$/.test(tok)) {
        return { symbol: tok, year };
      }
    }
  }

  // Fallback : premier segment avant _ ou espace
  const fallback = stem.split(/[_\s]/)[0]!.toUpperCase().slice(0, 6);
  return { symbol: fallback, year };
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
            revenue: data.revenue != null ? Math.round(data.revenue * M) : null,
            net_income: data.net_income != null ? Math.round(data.net_income * M) : null,
            equity: data.equity != null ? Math.round(data.equity * M) : null,
            debt: data.debt_total != null ? Math.round(data.debt_total * M) : null,
            shares: data.shares_outstanding ?? null,
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

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-surface border border-border rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-3 text-sm">
        <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          className="w-20 bg-bg border border-border rounded px-2 py-1 text-sm font-medium" />
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="w-20 bg-bg border border-border rounded px-2 py-1 text-sm" />
        <span className="text-muted text-xs truncate flex-1">{file.name}</span>
        <span className="text-xs">
          {status === 'reading' && '📄 lecture…'}
          {status === 'analyzing' && '🤖 analyse…'}
          {status === 'auto-saving' && '💾 écriture…'}
          {status === 'done' && <span className="text-up">✓ enregistré ({provider})</span>}
          {status === 'review' && <span className="text-warn">⚠️ à valider ({provider})</span>}
          {status === 'error' && <span className="text-down">✕ {error}</span>}
        </span>
        {status === 'error' && (
          <button type="button" onClick={() => void run()} className="text-xs text-up hover:underline">Réessayer</button>
        )}
      </div>
      {status === 'review' && extraction && (
        <FundamentalReview symbol={symbol} year={year} initial={extraction} suspects={suspects} onSaved={() => setStatus('done')} />
      )}
    </div>
  );
}
