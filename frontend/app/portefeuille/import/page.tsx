'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { readPdf } from '@/lib/import/pdfClient';
import { readJsonResponse } from '@/lib/import/fetchJson';
import PdfDropzone from '@/components/import/PdfDropzone';
import { SectionHeader, PremiumPanel } from '@/components/ui/premium';
import type { ReleveExtraction, ReleveGuard } from '@/lib/import/releveSchema';

type Status = 'idle' | 'reading' | 'analyzing' | 'review' | 'saving' | 'done' | 'error';

interface EditableRow {
  include: boolean;
  code: string;
  libelle: string;
  quantite: string;
  prix: string;
}

/**
 * Import de relevé de compte-titres SGI : dépôt PDF → extraction IA →
 * revue ligne par ligne (code/quantité/PRU éditables) → insertion portefeuille.
 * Différenciateur : aucun concurrent BRVM ne pré-remplit le portefeuille.
 */
export default function ImportRelevePage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('idle');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [instruments, setInstruments] = useState<{ code: string; libelle: string | null }[]>([]);
  const [meta, setMeta] = useState<{ sgi: string | null; date: string | null } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ inserted: number; skipped: string[] } | null>(null);

  async function analyse(file: File) {
    setError(null);
    setFileName(file.name);
    try {
      setStatus('reading');
      const pdf = await readPdf(file);
      setStatus('analyzing');
      const res = await fetch('/api/import-releve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', mode: pdf.mode, text: pdf.text, images: pdf.images }),
      });
      const j = await readJsonResponse(res);
      if (!j.ok) {
        setStatus('error');
        setError((j.data.error as string) ?? 'Échec de l’analyse');
        return;
      }
      const ext = j.data.extraction as ReleveExtraction;
      const guard = j.data.guard as ReleveGuard;
      setInstruments((j.data.instruments as { code: string; libelle: string | null }[]) ?? []);
      setMeta({ sgi: ext.sgi, date: ext.date_releve });
      setWarnings(guard.ok ? [] : guard.reasons);
      setRows(
        ext.positions.map((p) => ({
          include: p.code != null && p.quantite != null,
          code: p.code ?? '',
          libelle: p.libelle,
          quantite: p.quantite != null ? String(p.quantite) : '',
          prix: p.prix_unitaire != null ? String(p.prix_unitaire) : '',
        })),
      );
      setStatus('review');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Erreur de lecture du PDF');
    }
  }

  async function importer() {
    setError(null);
    const selected = rows.filter((r) => r.include);
    if (selected.length === 0) {
      setError('Cochez au moins une ligne à importer.');
      return;
    }
    try {
      setStatus('saving');
      const res = await fetch('/api/import-releve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'persist',
          rows: selected.map((r) => ({
            code: r.code.trim().toUpperCase(),
            quantite: Number(r.quantite),
            prix_entree: Number(r.prix.replace(',', '.')),
            date_entree: meta?.date ?? null,
          })),
        }),
      });
      const j = await readJsonResponse(res);
      if (!j.ok) {
        setStatus('review');
        setError((j.data.error as string) ?? 'Échec de l’import');
        return;
      }
      setResult({ inserted: j.data.inserted as number, skipped: (j.data.skipped as string[]) ?? [] });
      setStatus('done');
    } catch (e) {
      setStatus('review');
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  const patch = (i: number, p: Partial<EditableRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <SectionHeader
        kicker="Portefeuille"
        title="Importer mon relevé SGI"
        subtitle="Déposez le relevé de compte-titres PDF de votre SGI : vos positions sont détectées automatiquement, vous vérifiez, vous importez. Rien n'est écrit sans votre validation."
      />
      <div className="gold-rule" />

      {(status === 'idle' || status === 'error') && (
        <PremiumPanel className="p-5">
          <PdfDropzone onFiles={(accepted) => { if (accepted[0]) void analyse(accepted[0]); }} />
          {error && <p className="mt-3 text-sm text-down">✕ {error}</p>}
          <p className="mt-3 text-[11px] leading-relaxed text-faint">
            Le document est analysé par IA puis oublié — il n&apos;est ni stocké ni transmis à des tiers
            autres que le fournisseur d&apos;analyse. Limite : 10 analyses par heure.
          </p>
        </PremiumPanel>
      )}

      {(status === 'reading' || status === 'analyzing') && (
        <PremiumPanel className="p-8 text-center">
          <p className="text-sm text-muted">
            {status === 'reading' ? '📄 Lecture du PDF…' : '🤖 Détection des positions…'}
          </p>
          <p className="mt-1 truncate text-xs text-faint">{fileName}</p>
        </PremiumPanel>
      )}

      {status === 'review' || status === 'saving' ? (
        <PremiumPanel className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>
              {meta?.sgi ? <>Relevé <b className="text-ivory">{meta.sgi}</b></> : 'Relevé analysé'}
              {meta?.date ? <> · daté du <b className="text-ivory">{meta.date}</b></> : null}
            </span>
            <span className="text-faint">{rows.length} ligne(s) détectée(s)</span>
          </div>

          {warnings.length > 0 && (
            <div className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-[11px] text-warn">
              ⚠ {warnings.join(' · ')}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-2" aria-label="Inclure" />
                  <th className="py-2 pr-3 font-mono text-[10px] uppercase tracking-wider text-faint">Code</th>
                  <th className="py-2 pr-3 font-mono text-[10px] uppercase tracking-wider text-faint">Libellé relevé</th>
                  <th className="py-2 pr-3 text-right font-mono text-[10px] uppercase tracking-wider text-faint">Quantité</th>
                  <th className="py-2 text-right font-mono text-[10px] uppercase tracking-wider text-faint">PRU (FCFA)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-b border-border/50 last:border-0 ${r.include ? '' : 'opacity-45'}`}>
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={r.include}
                        onChange={(e) => patch(i, { include: e.target.checked })}
                        aria-label={`Inclure ${r.code || r.libelle}`}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        list="codes-brvm"
                        value={r.code}
                        onChange={(e) => patch(i, { code: e.target.value.toUpperCase() })}
                        placeholder="Code…"
                        aria-label={`Code BRVM ligne ${i + 1}`}
                        className="w-24 rounded border border-border bg-bg px-2 py-1 font-mono text-xs text-ivory"
                      />
                    </td>
                    <td className="max-w-[220px] truncate py-2 pr-3 text-xs text-muted" title={r.libelle}>{r.libelle}</td>
                    <td className="py-2 pr-3 text-right">
                      <input
                        type="number"
                        value={r.quantite}
                        onChange={(e) => patch(i, { quantite: e.target.value })}
                        aria-label={`Quantité ligne ${i + 1}`}
                        className="tabular w-24 rounded border border-border bg-bg px-2 py-1 text-right text-xs text-ivory"
                      />
                    </td>
                    <td className="py-2 text-right">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={r.prix}
                        onChange={(e) => patch(i, { prix: e.target.value })}
                        aria-label={`PRU ligne ${i + 1}`}
                        className="tabular w-28 rounded border border-border bg-bg px-2 py-1 text-right text-xs text-ivory"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <datalist id="codes-brvm">
            {instruments.map((it) => (
              <option key={it.code} value={it.code}>{it.libelle ?? it.code}</option>
            ))}
          </datalist>

          {error && <p className="text-sm text-down">✕ {error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void importer()}
              disabled={status === 'saving'}
              className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-obsidian shadow-gold-sm transition hover:bg-gold-2 disabled:opacity-50"
            >
              {status === 'saving' ? 'Import en cours…' : `Importer ${rows.filter((r) => r.include).length} position(s)`}
            </button>
            <button
              type="button"
              onClick={() => { setStatus('idle'); setRows([]); setError(null); }}
              className="rounded-full border border-border px-4 py-2 text-xs text-muted transition-colors hover:text-ivory"
            >
              Recommencer
            </button>
          </div>
        </PremiumPanel>
      ) : null}

      {status === 'done' && result && (
        <PremiumPanel className="space-y-3 p-6 text-center">
          <p className="text-lg text-up">✓ {result.inserted} position(s) importée(s)</p>
          {result.skipped.length > 0 && (
            <p className="text-xs text-warn">Ignorées : {result.skipped.join(' · ')}</p>
          )}
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/portefeuille')}
              className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-obsidian shadow-gold-sm transition hover:bg-gold-2"
            >
              Voir mon portefeuille →
            </button>
            <Link
              href="/portefeuille/import"
              onClick={() => { setStatus('idle'); setRows([]); setResult(null); }}
              className="rounded-full border border-border px-4 py-2.5 text-sm text-muted transition-colors hover:text-ivory"
            >
              Importer un autre relevé
            </Link>
          </div>
        </PremiumPanel>
      )}
    </div>
  );
}
