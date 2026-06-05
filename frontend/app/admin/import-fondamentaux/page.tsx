'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import PdfDropzone from '@/components/import/PdfDropzone';
import ImportRow from '@/components/import/ImportRow';

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

  function addFiles(accepted: File[]) {
    setFiles((prev) => [
      ...prev,
      ...accepted.map((file) => ({ id: `${file.name}-${Date.now()}-${Math.random()}`, file })),
    ]);
  }

  if (authed === false) {
    return <div className="p-6 text-muted">Connectez-vous pour importer des fondamentaux.</div>;
  }

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">📥 Import fondamentaux (IA)</h1>
        <p className="text-sm text-muted">
          Déposez des PDF d'états financiers : analyse par IA (DeepSeek → Mistral → Grok),
          écriture automatique si les valeurs sont plausibles, validation sinon.
        </p>
      </div>
      <PdfDropzone onFiles={addFiles} />
      <div className="space-y-2">
        {files.map((q) => <ImportRow key={q.id} file={q.file} validCodes={validCodes} />)}
      </div>
    </div>
  );
}
