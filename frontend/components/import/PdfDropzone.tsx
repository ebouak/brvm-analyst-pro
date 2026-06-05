'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export default function PdfDropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const onDrop = useCallback((accepted: File[]) => onFiles(accepted), [onFiles]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/pdf': ['.pdf'] }, multiple: true,
  });
  return (
    <div {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
        isDragActive ? 'border-up bg-up/5' : 'border-border hover:border-up/40'
      }`}>
      <input {...getInputProps()} />
      <p className="text-sm text-muted">📥 Glissez des PDF d'états financiers ici, ou cliquez pour choisir.</p>
      <p className="text-[10px] text-muted mt-1">Nom recommandé : SYMBOLE_ANNEE.pdf (ex. SNTS_2025.pdf)</p>
    </div>
  );
}
