'use client';

import { useState } from 'react';
import { Award, Check, Copy, ExternalLink, Printer, ShieldCheck } from 'lucide-react';

export default function CertificatPublicCarte({
  id,
  displayName,
  niveauLabel,
  niveauCode,
  issuedDate,
  competences,
  verifyUrl,
  qrDataUrl,
}: {
  id: string;
  displayName: string;
  niveauLabel: string;
  niveauCode: string;
  issuedDate: string;
  competences: readonly string[];
  verifyUrl: string;
  qrDataUrl?: string;
}) {
  const [copied, setCopied] = useState(false);

  const linkedinUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(
    `Academy WESTBOURSE · ${niveauLabel}`,
  )}&organizationName=WESTBOURSE&certUrl=${encodeURIComponent(verifyUrl)}&certId=${encodeURIComponent(id)}`;

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `Mon certificat ${niveauLabel} délivré par WESTBOURSE Academy : ${verifyUrl}`,
  )}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignorer
    }
  };

  return (
    <div className="w-full max-w-3xl space-y-6">
      {/* Carte diplôme imprimable */}
      <article className="cert-card relative overflow-hidden rounded-2xl border border-gold/40 bg-surface p-6 shadow-card sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/40 bg-gold/10 font-display text-sm font-bold text-gold">
              WB
            </span>
            <div>
              <p className="overline text-gold">WESTBOURSE Academy</p>
              <p className="text-xs text-muted">Formation & analyse des marchés UEMOA</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-up/30 bg-up/15 px-3 py-1 text-xs font-semibold text-up">
            <ShieldCheck size={14} aria-hidden />
            Certificat vérifiable
          </span>
        </div>

        <div className="py-8 text-center">
          <p className="text-xs uppercase tracking-widest text-faint">Attestation de réussite</p>
          <h1 className="mt-3 font-display text-3xl font-medium text-ivory sm:text-4xl">{displayName}</h1>
          <p className="mt-4 text-sm text-muted">a validé l’intégralité des leçons et réussi l’examen de certification du parcours</p>
          <p className="mt-2 inline-flex items-center gap-2 font-display text-xl font-semibold text-gold sm:text-2xl">
            <Award size={20} aria-hidden />
            <span>{niveauLabel}</span>
          </p>
        </div>

        {competences.length > 0 && (
          <div className="rounded-xl border border-border bg-bg/50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
              Compétences couvertes ({niveauCode})
            </p>
            <ul className="mt-2.5 grid gap-1.5 text-xs text-ivory/90 sm:grid-cols-2">
              {competences.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <Check size={13} className="mt-0.5 shrink-0 text-up" aria-hidden />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4">
          <div className="min-w-0 flex-1 space-y-1 text-xs text-faint">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>Délivré le {issuedDate}</span>
              <span className="tabular">Réf. {id}</span>
            </div>
            <p className="truncate text-[11px] text-faint">Vérification publique : {verifyUrl}</p>
          </div>

          {qrDataUrl && (
            <div className="flex shrink-0 flex-col items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR code de vérification du certificat"
                width={76}
                height={76}
                className="h-[76px] w-[76px] rounded-lg border border-gold/40 bg-[#f5f2eb] p-1"
              />
              <span className="text-[10px] font-medium text-faint">Scanner pour vérifier</span>
            </div>
          )}
        </div>
      </article>

      {/* Barre d'actions (masquée à l'impression PDF) */}
      <div className="cert-actions flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-bg hover:bg-gold-2"
        >
          <Printer size={14} aria-hidden />
          Imprimer / PDF
        </button>
        <a
          href={linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0a66c2] px-4 py-2 text-xs font-semibold text-[#ffffff] hover:opacity-95"
        >
          <ExternalLink size={14} aria-hidden />
          Ajouter à LinkedIn
        </a>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-xs font-medium text-ivory hover:border-accent/40"
        >
          {copied ? <Check size={14} className="text-up" aria-hidden /> : <Copy size={14} aria-hidden />}
          {copied ? 'Lien copié' : 'Copier le lien'}
        </button>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-medium text-muted hover:text-ivory"
        >
          Partager sur WhatsApp
        </a>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: landscape; margin: 12mm; }
          .cert-actions { display: none !important; }
          .cert-card { box-shadow: none !important; border-color: #c59b27 !important; }
        }
      `}</style>
    </div>
  );
}
