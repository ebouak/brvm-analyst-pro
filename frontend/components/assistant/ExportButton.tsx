'use client';
import { useState } from 'react';

interface ExportButtonProps {
  texteAnalyse: string;
  symbole?: string;
}

export function ExportButton({ texteAnalyse, symbole }: ExportButtonProps) {
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingDocx, setLoadingDocx] = useState(false);
  const [error, setError] = useState('');

  const exporter = async (format: 'pdf' | 'docx') => {
    const setLoading = format === 'pdf' ? setLoadingPdf : setLoadingDocx;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texte: texteAnalyse, symbole }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur serveur');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BRVM_Analyse_${symbole || 'rapport'}_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const Spinner = () => (
    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );

  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
      <span className="text-[10px] text-faint uppercase tracking-wider">Télécharger</span>

      <button
        type="button"
        onClick={() => exporter('pdf')}
        disabled={loadingPdf || loadingDocx}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-chip border border-down/30 text-down hover:bg-down/10 disabled:opacity-40 transition-colors active:scale-95"
        title="Télécharger en PDF"
      >
        {loadingPdf ? <Spinner /> : (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
          </svg>
        )}
        {loadingPdf ? 'Génération…' : 'PDF'}
      </button>

      <button
        type="button"
        onClick={() => exporter('docx')}
        disabled={loadingPdf || loadingDocx}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-chip border border-info/30 text-info hover:bg-info/10 disabled:opacity-40 transition-colors active:scale-95"
        title="Télécharger en Word éditable"
      >
        {loadingDocx ? <Spinner /> : (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
        )}
        {loadingDocx ? 'Génération…' : 'Word'}
      </button>

      {error && <span className="text-[10px] text-down ml-1">{error}</span>}
    </div>
  );
}
