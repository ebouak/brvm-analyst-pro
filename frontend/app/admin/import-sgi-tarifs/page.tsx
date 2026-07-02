'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { readPdf } from '@/lib/import/pdfClient';
import { readJsonResponse } from '@/lib/import/fetchJson';
import PdfDropzone from '@/components/import/PdfDropzone';
import { SectionHeader, PremiumPanel } from '@/components/ui/premium';
import type { SgiTarifExtraction, GuardResult } from '@/lib/import/sgiTarifSchema';

interface Queued { id: string; file: File; }

type Status = 'pending' | 'reading' | 'analyzing' | 'review' | 'saving' | 'done' | 'error';

const FIELDS: { key: keyof SgiTarifExtraction; label: string; suffix: string }[] = [
  { key: 'courtage_pct_max', label: 'Courtage', suffix: '%' },
  { key: 'minimum_perception', label: 'Min. perception', suffix: 'FCFA' },
  { key: 'droits_garde_pct_max', label: 'Droits de garde', suffix: '%' },
  { key: 'droits_garde_minimum', label: 'Plancher garde', suffix: 'FCFA' },
  { key: 'tenue_compte_montant', label: 'Tenue de compte', suffix: 'FCFA' },
  { key: 'frais_virement', label: 'Virement', suffix: 'FCFA' },
  { key: 'depot_minimum', label: 'Dépôt minimum', suffix: 'FCFA' },
];

function ImportRow({ file }: { file: File }) {
  const [sgiNom, setSgiNom] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [status, setStatus] = useState<Status>('pending');
  const [provider, setProvider] = useState<string | null>(null);
  const [data, setData] = useState<SgiTarifExtraction | null>(null);
  const [guard, setGuard] = useState<GuardResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyse() {
    if (!sgiNom.trim()) { setError('Sélectionnez ou saisissez la SGI cible.'); setStatus('error'); return; }
    setError(null);
    try {
      setStatus('reading');
      const pdf = await readPdf(file);
      setStatus('analyzing');
      const res = await fetch('/api/import-sgi-tarifs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sgiNom, mode: pdf.mode, text: pdf.text, images: pdf.images, sourceLabel, persist: false }),
      });
      const j = await readJsonResponse(res);
      if (!j.ok) { setStatus('error'); setError((j.data.error as string) ?? 'Échec analyse'); return; }
      setProvider(j.data.provider as string);
      setData(j.data.data as SgiTarifExtraction);
      setGuard(j.data.guard as GuardResult);
      setStatus('review');
    } catch (e) {
      setStatus('error'); setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function importer() {
    setError(null);
    try {
      setStatus('saving');
      const pdf = await readPdf(file);
      const res = await fetch('/api/import-sgi-tarifs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sgiNom, mode: pdf.mode, text: pdf.text, images: pdf.images, sourceLabel, persist: true }),
      });
      const j = await readJsonResponse(res);
      if (!j.ok || !j.data.persisted) { setStatus('error'); setError((j.data.error as string) ?? 'Écriture refusée'); return; }
      setStatus('done');
    } catch (e) {
      setStatus('error'); setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <input
          list="sgi-noms"
          value={sgiNom}
          onChange={(e) => setSgiNom(e.target.value)}
          placeholder="SGI cible"
          aria-label="SGI cible"
          className="w-56 bg-bg border border-border rounded px-2 py-1 text-sm text-ivory"
        />
        <span className="text-muted text-xs truncate flex-1">{file.name}</span>
        <span className="text-xs">
          {status === 'pending' && <span className="text-faint">en attente</span>}
          {status === 'reading' && '📄 lecture…'}
          {status === 'analyzing' && '🤖 analyse…'}
          {status === 'saving' && '💾 écriture…'}
          {status === 'review' && <span className="text-warn">à valider ({provider})</span>}
          {status === 'done' && <span className="text-up">✓ importé</span>}
          {status === 'error' && <span className="text-down">✕ {error}</span>}
        </span>
        {(status === 'pending' || status === 'error') && (
          <button type="button" onClick={() => void analyse()}
            className="text-xs px-2.5 py-1 rounded bg-info text-bg font-semibold hover:opacity-90 active:scale-95 transition-all">
            Analyser
          </button>
        )}
      </div>

      <input
        value={sourceLabel}
        onChange={(e) => setSourceLabel(e.target.value)}
        placeholder="Référence source (ex. Décision PAMF-UMOA/2024/163 du 26/06/2024)"
        aria-label="Référence de la source"
        className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-muted"
      />

      {status === 'review' && data && guard && (
        <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {FIELDS.map((f) => {
              const v = data[f.key] as number | null;
              return (
                <div key={f.key} className="flex items-baseline justify-between gap-2 border-b border-border/40 py-0.5">
                  <span className="text-[11px] text-muted">{f.label}</span>
                  <span className={`tabular text-xs ${v == null ? 'text-faint' : 'text-ivory'}`}>
                    {v == null ? 'null' : `${v.toLocaleString('fr-FR')} ${f.suffix}`}
                  </span>
                </div>
              );
            })}
          </div>
          {guard.ok ? (
            <p className="text-[11px] text-up">✓ Barème plausible — sera tagué « barème homologué CREPMF ».</p>
          ) : (
            <p className="text-[11px] text-warn">⚠ {guard.reasons.join(' · ')}</p>
          )}
          <button
            type="button"
            onClick={() => void importer()}
            disabled={!guard.ok}
            className="text-xs px-3 py-1.5 rounded bg-up text-bg font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Importer dans sgi_frais
          </button>
        </div>
      )}
    </div>
  );
}

export default function ImportSgiTarifsPage() {
  const [files, setFiles] = useState<Queued[]>([]);
  const [sgiNoms, setSgiNoms] = useState<string[]>([]);

  useEffect(() => {
    const sb = createClient();
    sb.from('sgi_directory').select('nom').order('nom').then(({ data }) => {
      setSgiNoms((data ?? []).map((r) => r.nom as string));
    });
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        kicker="Administration"
        title="Import tarifs SGI"
        subtitle="Déposez un PDF de barème (décision CREPMF / grille officielle). Analyse par IA vision (Mistral/Grok), garde-fous de plausibilité, écriture dans sgi_frais après revue — jamais un barème hors bornes."
      />
      <div className="gold-rule" />

      <datalist id="sgi-noms">
        {sgiNoms.map((n) => <option key={n} value={n} />)}
      </datalist>

      <div className="space-y-1.5">
        <p className="overline text-faint">Dépôt de fichiers</p>
        <PremiumPanel className="p-5">
          <PdfDropzone onFiles={(accepted) =>
            setFiles((prev) => [
              ...prev,
              ...accepted.map((file) => ({ id: `${file.name}-${Date.now()}-${Math.random()}`, file })),
            ])
          } />
        </PremiumPanel>
      </div>

      {files.length > 0 && (
        <PremiumPanel className="divide-y divide-border/40">
          {files.map((q) => <ImportRow key={q.id} file={q.file} />)}
        </PremiumPanel>
      )}
    </div>
  );
}
