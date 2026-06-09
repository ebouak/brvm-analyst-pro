'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import PdfDropzone from '@/components/import/PdfDropzone';
import ImportRow from '@/components/import/ImportRow';
import BatchImportPanel from '@/components/import/BatchImportPanel';
import { SectionHeader, PremiumPanel } from '@/components/ui/premium';

interface Queued { id: string; file: File; }

export default function ImportFondamentauxPage() {
  const [files, setFiles] = useState<Queued[]>([]);
  const [validCodes, setValidCodes] = useState<Set<string>>(new Set());
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    sb.from('brvm_instruments').select('code').eq('type', 'action').then(({ data }) => {
      setValidCodes(new Set((data ?? []).map((r) => r.code as string)));
    });
  }, []);

  if (authed === false) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <PremiumPanel className="px-6 py-5">
          <p className="text-sm text-muted">Connectez-vous pour importer des fondamentaux.</p>
        </PremiumPanel>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

      {/* En-tête de page */}
      <SectionHeader
        kicker="Administration"
        title="Import fondamentaux"
        subtitle="Déposez des PDF d'états financiers. Analyse par IA (DeepSeek → Mistral → Grok), écriture automatique si les valeurs sont plausibles, validation sinon."
      />

      {/* Filet or décoratif */}
      <div className="gold-rule" />

      {/* Import batch */}
      <div className="space-y-1.5">
        <p className="overline text-faint">Import groupé</p>
        <PremiumPanel className="p-5">
          <BatchImportPanel />
        </PremiumPanel>
      </div>

      {/* Zone de dépôt PDF */}
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

      {/* Queue de traitement */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="overline text-faint">En attente de traitement</p>
            <span className="tabular text-[11px] text-muted border border-border rounded-full px-2.5 py-0.5">
              {files.length} fichier{files.length > 1 ? 's' : ''}
            </span>
          </div>
          <PremiumPanel className="divide-y divide-border/40">
            {files.map((q) => (
              <div key={q.id} className="px-5 py-3 transition-colors duration-200 hover:bg-elevated/60">
                <ImportRow file={q.file} validCodes={validCodes} />
              </div>
            ))}
          </PremiumPanel>
        </div>
      )}

      {/* Note pipeline IA */}
      <div className="flex items-start gap-3 rounded-card border border-border/50 bg-surface/60 px-4 py-3 shadow-card">
        <span className="mt-0.5 shrink-0 text-gold/60 text-xs">◈</span>
        <p className="text-xs text-faint leading-relaxed">
          Pipeline IA&nbsp;: <span className="text-muted">DeepSeek → Mistral → Grok</span>.
          Écriture automatique si plausibilité &gt;&nbsp;95&nbsp;%. Les valeurs hors seuil sont soumises
          à validation manuelle avant persistance.
        </p>
      </div>

    </div>
  );
}
