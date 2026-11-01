// frontend/app/admin/crm/ReglagesForm.tsx — réglages de la relance pilotée (spec CRM v2 §2.2).
'use client';
import { useRef, useState, useTransition } from 'react';
import { enregistrerReglages } from './reglages/actions';
import { BORNES, type ModeSequences, type Reglages } from '@/lib/crm/reglages';

type Retour = { ok: boolean; message: string };
const CHAMP = 'w-28 rounded-md border border-border bg-sunken px-3 py-1.5 text-sm text-ivory tabular';

const CHAMPS: { nom: keyof typeof BORNES; aide: string; unite: string }[] = [
  { nom: 'max_relances', aide: 'Au-delà, plus aucune relance (manuelle ou automatique).', unite: 'relances' },
  { nom: 'delai_min_jours', aide: 'Temps à laisser entre deux relances.', unite: 'jours' },
  { nom: 'delai_suivi_jours', aide: "Après ce délai sans réponse, la personne repasse dans « À traiter ».", unite: 'jours' },
  { nom: 'fenetre_conversion_jours', aide: "Un paiement compte comme « conversion après relance » s'il arrive dans ce délai après la 1re relance.", unite: 'jours' },
  { nom: 'plafond_par_execution', aide: "Nombre maximal d'envois par passage des séquences automatiques.", unite: 'envois' },
];

const MODES: { valeur: ModeSequences; titre: string; texte: string }[] = [
  { valeur: 'off', titre: 'Désactivé', texte: 'Aucune séquence automatique. Réglage par défaut.' },
  { valeur: 'simulation', titre: 'Simulation', texte: "Rien n'est envoyé : chaque passage journalise ce qu'il aurait envoyé." },
  { valeur: 'actif', titre: 'Actif', texte: 'Envoie réellement les e-mails.' },
];

export default function ReglagesForm({ initial, modifieLe }: { initial: Reglages; modifieLe: string | null }) {
  const [mode, setMode] = useState<ModeSequences>(initial.mode_sequences);
  const [confirme, setConfirme] = useState(false);
  const [retour, setRetour] = useState<Retour | null>(null);
  const effacer = () => setRetour(null);
  const [pending, demarrer] = useTransition();
  const verrou = useRef(false);
  const [occupe, setOccupe] = useState(false);

  // « Actif » exige d'avoir coché la confirmation, sauf s'il l'était déjà avant la modification.
  const bloque = mode === 'actif' && initial.mode_sequences !== 'actif' && !confirme;

  const envoyer = (form: FormData) => {
    if (verrou.current || bloque) return;
    verrou.current = true;
    setOccupe(true);
    demarrer(async () => {
      try { setRetour(await enregistrerReglages(form)); }
      catch { setRetour({ ok: false, message: 'Erreur serveur : réglages non enregistrés.' }); }
      finally { verrou.current = false; setOccupe(false); }
    });
  };

  return (
    <form action={envoyer} onChange={effacer} className="space-y-6">
      <fieldset className="space-y-4 rounded-card border border-border bg-surface p-5">
        <legend className="px-1 text-sm font-semibold text-ivory">Règles de relance</legend>
        {CHAMPS.map(({ nom, aide, unite }) => {
          const [min, max, lib] = BORNES[nom];
          return (
            <div key={nom} className="space-y-1">
              <label htmlFor={nom} className="block text-sm text-ivory">{lib}</label>
              <div className="flex items-center gap-2">
                <input id={nom} name={nom} type="number" inputMode="numeric" step={1} min={min} max={max} required defaultValue={initial[nom]} className={CHAMP} aria-describedby={`${nom}-aide`} />
                <span className="text-xs text-faint">{unite} · de {min} à {max}</span>
              </div>
              <p id={`${nom}-aide`} className="text-xs text-muted">{aide}</p>
            </div>
          );
        })}
      </fieldset>

      <fieldset className="space-y-3 rounded-card border border-border bg-surface p-5">
        <legend className="px-1 text-sm font-semibold text-ivory">Séquences automatiques</legend>
        <p className="text-xs text-muted">Les séquences automatiques arrivent ; ce réglage sera pris en compte dès leur mise en service.</p>
        {MODES.map((m) => (
          <label key={m.valeur} className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${mode === m.valeur ? 'border-accent bg-accent/5' : 'border-border'}`}>
            <input type="radio" name="mode_sequences" value={m.valeur} checked={mode === m.valeur} onChange={() => { setMode(m.valeur); if (m.valeur !== 'actif') setConfirme(false); effacer(); }} className="mt-1" />
            <span>
              <span className="block text-sm text-ivory">{m.titre}</span>
              <span className="block text-xs text-muted">{m.texte}</span>
            </span>
          </label>
        ))}
        {mode === 'actif' && initial.mode_sequences !== 'actif' && (
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
            <input type="checkbox" checked={confirme} onChange={(e) => { setConfirme(e.target.checked); effacer(); }} className="mt-1" />
            <span>J&apos;ai relu au moins une semaine de simulation</span>
          </label>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || occupe || bloque} className="rounded-full border border-border px-5 py-1.5 text-sm text-ivory hover:border-accent disabled:opacity-50">Enregistrer</button>
        {modifieLe && <span className="text-xs text-faint">Modifié le {modifieLe}</span>}
        <div role="status" aria-live="polite">{retour?.ok && <p className="text-sm text-up">{retour.message}</p>}</div>
        {retour && !retour.ok && <p role="alert" className="text-sm text-down">{retour.message}</p>}
      </div>
    </form>
  );
}
