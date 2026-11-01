// frontend/app/admin/crm/[cle]/RelanceWhatsapp.tsx
'use client';
import { useRef, useState, useTransition } from 'react';
import { preparerRelanceWhatsapp } from './actions';
import type { TemplateId } from '@/lib/crm/gabarits';

const NUMERO_WESTBOURSE = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');

export default function RelanceWhatsapp({ cle, templateId, texteInitial, numero, source }: {
  cle: string; templateId: TemplateId; texteInitial: string; numero: string; source: 'prouve' | 'declare';
}) {
  const [texte, setTexte] = useState(texteInitial);
  const [offre, setOffre] = useState(true);
  const [retour, setRetour] = useState<{ ok: boolean; message: string } | null>(null);
  const [lien, setLien] = useState<string | null>(null);
  const [pending, demarrer] = useTransition();
  const verrou = useRef(false);
  const [occupe, setOccupe] = useState(false);
  const envoi = pending || occupe;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        <span className="tabular text-ivory">{numero}</span> · {source === 'prouve' ? 'numéro prouvé (appairage)' : 'numéro déclaré, non vérifié'}
      </p>
      <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={6} className="w-full rounded-md border border-border bg-sunken px-3 py-2 text-sm" aria-label="Message WhatsApp" />
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={offre} onChange={(e) => setOffre(e.target.checked)} />
        Ajouter le lien « dossier valeur au choix »
      </label>
      <p className="text-xs text-faint">La mention « Répondez STOP » est ajoutée automatiquement. WhatsApp s&apos;ouvre avec le message : c&apos;est vous qui l&apos;envoyez. {NUMERO_WESTBOURSE ? `Envoyez-le depuis le WhatsApp WESTBOURSE (+${NUMERO_WESTBOURSE})` : 'Envoyez-le depuis le WhatsApp WESTBOURSE'} : sinon, un STOP de la personne ne nous parviendra pas.</p>
      <button
        disabled={envoi}
        onClick={() => {
          if (verrou.current) return;
          verrou.current = true; setOccupe(true);
          // Fenêtre ouverte AVANT l'appel serveur : sinon le navigateur bloque le popup.
          setLien(null);
          const fenetre = window.open('', '_blank');
          if (fenetre) fenetre.opener = null;
          demarrer(async () => {
            try {
              const r = await preparerRelanceWhatsapp(cle, texte, templateId, offre);
              setLien(r.ok && r.url ? r.url : null);
              setRetour(r.ok && !fenetre ? { ok: true, message: "Message prêt, mais la fenêtre WhatsApp a été bloquée par le navigateur : utilisez le lien ci-dessous." } : r);
              if (r.ok && r.url && fenetre) fenetre.location.href = r.url;
              else fenetre?.close();
            } catch {
              fenetre?.close();
              setRetour({ ok: false, message: "Erreur serveur : rien n'a été préparé." });
            } finally { verrou.current = false; setOccupe(false); }
          });
        }}
        className="rounded-full bg-[#25D366] px-5 py-2 text-sm font-semibold text-[#06210f] disabled:opacity-50"
      >
        {envoi ? 'Préparation…' : 'Ouvrir WhatsApp avec ce message'}
      </button>
      {lien && <a href={lien} target="_blank" rel="noopener noreferrer" className="block text-sm text-accent underline underline-offset-4">Ouvrir WhatsApp avec ce message</a>}
      {retour && <p className={`text-sm ${retour.ok ? 'text-up' : 'text-down'}`}>{retour.message}</p>}
    </div>
  );
}
