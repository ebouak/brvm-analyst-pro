'use client';

import { useState, useTransition } from 'react';
import { Phone } from 'lucide-react';
import { lancerAppelDeTest, lireAppelDeTest, type EtatTest } from '@/app/admin/controle/actions';

const LIBELLE_STATUT: Record<string, string> = {
  en_cours: 'en cours',
  en_file: 'en file chez Bland',
  termine: 'terminé',
  non_decroche: 'non décroché',
  echec: 'échec',
  peut_etre_parti: 'peut-être parti',
};

/**
 * Bouton « Appel de test » de la Tour de contrôle. Deux temps (armer, puis
 * confirmer) : l'appel est payant et sonne réellement sur le téléphone de
 * l'exploitant. Il prouve la chaîne site → Bland → téléphone sans faux incident.
 */
export function AppelTest() {
  const [arme, setArme] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [appelId, setAppelId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ton: 'ok' | 'erreur'; texte: string } | null>(null);
  const [etat, setEtat] = useState<EtatTest | null>(null);

  const lancer = () =>
    demarrer(async () => {
      setMessage(null);
      setEtat(null);
      const r = await lancerAppelDeTest();
      setArme(false);
      if (r.appelId) setAppelId(r.appelId);
      setMessage(
        r.ok
          ? { ton: 'ok', texte: 'Appel lancé : votre téléphone devrait sonner dans les secondes qui viennent.' }
          : { ton: 'erreur', texte: r.message },
      );
    });

  const relire = () =>
    demarrer(async () => {
      if (!appelId) return;
      setEtat(await lireAppelDeTest(appelId));
    });

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Appelle le numéro d&apos;exploitation avec un message fixe « ceci est un appel de test ». Même chemin qu&apos;une
        vraie alerte (opposition, plafond du jour, trace avant l&apos;appel), sans simuler d&apos;incident. Payant, une
        minute au plus.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {!arme ? (
          <button
            type="button"
            onClick={() => setArme(true)}
            disabled={enCours}
            className="inline-flex items-center gap-2 rounded-full border border-accent/40 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10 disabled:opacity-50"
          >
            <Phone className="h-4 w-4" aria-hidden />
            Appel de test
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={lancer}
              disabled={enCours}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50"
            >
              {enCours ? 'Appel…' : 'Confirmer l’appel'}
            </button>
            <button type="button" onClick={() => setArme(false)} disabled={enCours} className="px-3 py-2 text-sm text-muted hover:text-ivory">
              Annuler
            </button>
          </>
        )}
        {appelId && (
          <button
            type="button"
            onClick={relire}
            disabled={enCours}
            className="rounded-full border border-border px-4 py-2 text-sm text-ivory hover:bg-elevated disabled:opacity-50"
          >
            Actualiser le statut
          </button>
        )}
      </div>
      {message && (
        <p role={message.ton === 'erreur' ? 'alert' : 'status'} className={`text-sm ${message.ton === 'ok' ? 'text-up' : 'text-down'}`}>
          {message.texte}
        </p>
      )}
      {etat &&
        (etat.ok ? (
          <p role="status" className="text-sm text-ivory">
            Statut : <span className="font-semibold">{LIBELLE_STATUT[etat.statut] ?? etat.statut}</span>
            {etat.dureeMin != null && <> · durée <span className="tabular">{etat.dureeMin.toFixed(2)}</span> min</>}
            {etat.finPar && <> · terminé par {etat.finPar}</>}
            {etat.erreur && <span className="block text-xs text-warn">{etat.erreur}</span>}
          </p>
        ) : (
          <p role="alert" className="text-sm text-down">{etat.message}</p>
        ))}
    </div>
  );
}
