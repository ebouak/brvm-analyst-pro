// frontend/app/offre/dossier/Choix.tsx
'use client';
import { useMemo, useState, useTransition } from 'react';
import { choisirDossier } from './actions';

type Valeur = { code: string; designation: string; secteur: string | null };

export default function Choix({ jeton, valeurs }: { jeton: string; valeurs: Valeur[] }) {
  const [filtre, setFiltre] = useState('');
  const [enCours, setEnCours] = useState<string | null>(null);
  const [fini, setFini] = useState(false);
  const [lien, setLien] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [, demarrer] = useTransition();
  const liste = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    return f ? valeurs.filter((v) => v.code.toLowerCase().includes(f) || v.designation.toLowerCase().includes(f)) : valeurs;
  }, [filtre, valeurs]);

  const choisir = (code: string) => {
    setEnCours(code);
    setMessage(null);
    demarrer(async () => {
      try {
        const r = await choisirDossier(jeton, code);
        if (r.ok) {
          // Le jeton est consommé : plus aucun autre choix possible.
          setFini(true);
          setLien(r.url);
          setMessage({ ok: true, texte: 'Votre dossier se télécharge. Bonne lecture !' });
          window.location.href = r.url;
        } else setMessage({ ok: false, texte: r.message });
      } catch {
        setMessage({ ok: false, texte: 'Erreur de connexion : réessayez.' });
      } finally {
        setEnCours(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      <input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Rechercher une société (ex. Sonatel, SNTS)" aria-label="Rechercher une société" className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ivory placeholder:text-faint" />
      {message && <p role="status" className={`rounded-lg border px-4 py-3 text-sm ${message.ok ? 'border-up/40 bg-up/10 text-up' : 'border-down/40 bg-down/10 text-down'}`}>{message.texte}</p>}
      {fini && lien && (
        <p className="text-sm text-muted">
          Le téléchargement ne démarre pas ?{' '}
          <a href={lien} className="text-accent underline">Cliquez ici</a> (lien valable 10 minutes).
        </p>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {liste.map((v) => (
          <li key={v.code}>
            <button disabled={enCours !== null || fini} aria-busy={enCours === v.code} onClick={() => choisir(v.code)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-accent/60 disabled:opacity-60">
              <span>
                <span className="tabular block text-sm font-semibold text-ivory">
                  {v.code}
                </span>
                <span className="block text-xs text-muted">{v.designation}{v.secteur ? ` · ${v.secteur}` : ''}</span>
              </span>
              <span className="shrink-0 whitespace-nowrap text-xs text-accent">{enCours === v.code ? '…' : 'Choisir →'}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
