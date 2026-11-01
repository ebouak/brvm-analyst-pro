// frontend/app/admin/crm/[cle]/RelanceForm.tsx
'use client';
import { useState, useTransition } from 'react';
import { envoyerRelance } from './actions';
import type { TemplateId } from '@/lib/crm/gabarits';

export default function RelanceForm({ cle, templateId, sujetInitial, corpsInitial, relanceRecente, oppose }: {
  cle: string; templateId: TemplateId; sujetInitial: string; corpsInitial: string; relanceRecente: string | null; oppose: boolean;
}) {
  const [sujet, setSujet] = useState(sujetInitial);
  const [corps, setCorps] = useState(corpsInitial);
  const [retour, setRetour] = useState<{ ok: boolean; message: string } | null>(null);
  const [offre, setOffre] = useState(true);
  const [envoi, demarrer] = useTransition();
  if (oppose) return <p className="text-sm text-down">Cette personne s&apos;est opposée aux propositions commerciales : relance désactivée.</p>;
  return (
    <div className="space-y-3">
      {relanceRecente && <p className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">Déjà relancée le {relanceRecente} : moins de 14 jours.</p>}
      <input value={sujet} onChange={(e) => setSujet(e.target.value)} className="w-full rounded-md border border-border bg-sunken px-3 py-2 text-sm" aria-label="Sujet" />
      <textarea value={corps} onChange={(e) => setCorps(e.target.value)} rows={10} className="w-full rounded-md border border-border bg-sunken px-3 py-2 text-sm" aria-label="Message" />
      <p className="text-xs text-faint">Logo, bouton WhatsApp, pied de page et lien d&apos;opposition sont ajoutés automatiquement.</p>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={offre} onChange={(e) => setOffre(e.target.checked)} />
        Inclure l&apos;offre « dossier valeur au choix » (lien valable 14 jours, un dossier)
      </label>
      <button disabled={envoi} onClick={() => demarrer(async () => { try { setRetour(await envoyerRelance(cle, sujet, corps, templateId, offre)); } catch { setRetour({ ok: false, message: "Erreur serveur : rien n'a été envoyé." }); } })} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-bg disabled:opacity-50">
        {envoi ? 'Envoi…' : 'Envoyer la relance'}
      </button>
      {retour && <p className={`text-sm ${retour.ok ? 'text-up' : 'text-down'}`}>{retour.message}</p>}
    </div>
  );
}
