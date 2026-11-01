'use client';
// Relance e-mail en masse : sélection (cases du tableau), confirmation calculée par le serveur, envoi SÉQUENTIEL piloté ici.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { preparerRelanceMasse, relancerUn } from './actionsMasse';

type Ctx = { selection: Set<string>; bascule: (c: string) => void; toutBasculer: () => void; total: number };
const MasseCtx = createContext<Ctx | null>(null);

const LIB_GABARIT: Record<string, string> = {
  paiement_inacheve: 'Paiement inachevé', offre_consultee: 'Offre consultée', actif_sans_abonnement: 'Actif sans abonnement', prospect_sans_compte: 'Prospect sans compte',
};
type Tri = { eligibles: { cle: string; nom: string; gabarit: string }[]; ecartes: { cle: string; nom: string; raison: string }[] };
type Ligne = { nom: string; message: string };
type Phase =
  | { etat: 'confirmation'; tri: Tri }
  | { etat: 'envoi' | 'fini'; tri: Tri; faits: number; echecs: Ligne[]; ecartsEnVol: Ligne[]; arret: boolean };

/** `cles` = lignes actuellement affichées (vue + filtres) : « tout sélectionner » ne déborde jamais sur ce qu'on ne voit pas. */
export function MasseProvider({ cles, peutEcrire, masquerBarre = false, children }: { cles: string[]; peutEcrire: boolean; masquerBarre?: boolean; children: ReactNode }) {
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const clesKey = cles.join('\n');
  const affichees = useMemo(() => new Set(clesKey ? clesKey.split('\n') : []), [clesKey]);
  // Un filtre qui retire une ligne la retire aussi de la sélection : on n'envoie jamais à une personne qu'on ne voit plus.
  useEffect(() => { setSelection((s) => { const n = new Set([...s].filter((c) => affichees.has(c))); return n.size === s.size ? s : n; }); }, [affichees]);
  const bascule = useCallback((c: string) => setSelection((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n; }), []);
  const toutBasculer = useCallback(() => setSelection((s) => (s.size === affichees.size ? new Set() : new Set(affichees))), [affichees]);
  if (!peutEcrire) return <>{children}</>;
  return (
    <MasseCtx.Provider value={{ selection, bascule, toutBasculer, total: affichees.size }}>
      {children}
      <BarreMasse vider={() => setSelection(new Set())} masquee={masquerBarre} />
    </MasseCtx.Provider>
  );
}

export function CaseTout() {
  const c = useContext(MasseCtx);
  if (!c) return null;
  const tout = c.total > 0 && c.selection.size === c.total;
  return (
    <input type="checkbox" aria-label={`Tout sélectionner (${c.total})`} title={`Tout sélectionner (${c.total})`} checked={tout}
      ref={(el) => { if (el) el.indeterminate = c.selection.size > 0 && !tout; }} onChange={c.toutBasculer} />
  );
}
export function CaseLigne({ cle, nom }: { cle: string; nom: string }) {
  const c = useContext(MasseCtx);
  if (!c) return null;
  // z-10 : au-dessus du lien étiré de la ligne, sinon cocher ouvrirait la fiche.
  return <input type="checkbox" className="relative z-10" aria-label={`Sélectionner ${nom}`} checked={c.selection.has(cle)} onChange={() => c.bascule(cle)} />;
}

function BarreMasse({ vider, masquee }: { vider: () => void; masquee: boolean }) {
  const c = useContext(MasseCtx)!;
  const router = useRouter();
  const [offre, setOffre] = useState(true);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const verrou = useRef(false);
  const arret = useRef(false);
  const [occupe, setOccupe] = useState(false);
  const n = c.selection.size;

  async function ouvrir() {
    if (verrou.current) return;
    verrou.current = true; setOccupe(true); setErreur(null);
    try {
      const r = await preparerRelanceMasse([...c.selection]);
      if (!r.ok) setErreur(r.message ?? 'Préparation impossible.'); else setPhase({ etat: 'confirmation', tri: r });
    } catch { setErreur('Erreur serveur : rien n’est envoyé.'); } finally { verrou.current = false; setOccupe(false); }
  }

  async function lancer(tri: Tri) {
    if (verrou.current) return; // double clic sur « Confirmer » : une seule boucle
    verrou.current = true; arret.current = false;
    let faits = 0; const echecs: Ligne[] = []; const ecartsEnVol: Ligne[] = [];
    const maj = (etat: 'envoi' | 'fini') => setPhase({ etat, tri, faits, echecs: [...echecs], ecartsEnVol: [...ecartsEnVol], arret: arret.current });
    maj('envoi');
    try {
      for (const p of tri.eligibles) {
        if (arret.current) break;
        try {
          const r = await relancerUn(p.cle, offre);
          if (r.ok) faits++;
          // Refusé au dernier contrôle (paiement, opposition, doublon…) : écarté, pas une panne.
          else if (r.statut === 'refus') ecartsEnVol.push({ nom: p.nom, message: r.message });
          else echecs.push({ nom: p.nom, message: r.message });
        } catch { echecs.push({ nom: p.nom, message: 'Erreur serveur : envoi non confirmé, vérifier le journal avant de relancer.' }); }
        maj('envoi');
      }
    } finally { verrou.current = false; maj('fini'); router.refresh(); }
  }

  const fermer = () => { const fini = phase?.etat === 'fini'; setPhase(null); if (fini) vider(); };
  if (n === 0 && !phase) return null;
  return (
    <>
      {n > 0 && !phase && !masquee && (
        <>
        {/* Réserve la hauteur de la barre fixe : les dernières lignes ne sont jamais recouvertes. */}
        <div aria-hidden className="h-28" />
        <div role="region" aria-label="Actions sur la sélection" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-6 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="tabular text-ivory">{n} sélectionnée{n > 1 ? 's' : ''}</span>
            <button type="button" onClick={ouvrir} disabled={occupe} className="rounded-full bg-accent px-4 py-1.5 font-semibold text-bg disabled:opacity-50">{occupe ? 'Vérification…' : `Relancer par e-mail (${n})`}</button>
            <label className="flex items-center gap-2 text-muted"><input type="checkbox" checked={offre} onChange={(e) => setOffre(e.target.checked)} />Inclure l&apos;offre dossier</label>
            <button type="button" onClick={vider} className="text-muted hover:text-ivory">Désélectionner</button>
            <span className="text-xs text-faint">WhatsApp reste à l&apos;unité (risque de blocage du numéro).</span>
            {erreur && <span role="alert" className="text-down">{erreur}</span>}
          </div>
        </div>
        </>
      )}
      {phase && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="masse-titre">
          <div className="max-h-[85vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-lg border border-border bg-surface p-6 text-sm">
            <h2 id="masse-titre" className="font-display text-xl text-ivory">Relance en masse par e-mail</h2>
            {phase.etat === 'confirmation' ? (<>
              <p className="text-ivory"><b className="tabular">{phase.tri.eligibles.length}</b> partiront, <b className="tabular">{phase.tri.ecartes.length}</b> écartée{phase.tri.ecartes.length > 1 ? 's' : ''}.</p>
              {phase.tri.ecartes.length > 0 && (
                <div><p className="mb-1 font-medium text-down">Écartées</p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-muted">{phase.tri.ecartes.map((e) => <li key={e.cle}><span className="text-ivory">{e.nom}</span> — {e.raison}</li>)}</ul></div>
              )}
              {phase.tri.eligibles.length > 0 && (
                <div><p className="mb-1 font-medium text-up">Destinataires et gabarit</p>
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-muted">{phase.tri.eligibles.map((e) => <li key={e.cle}><span className="text-ivory">{e.nom}</span> — {LIB_GABARIT[e.gabarit] ?? e.gabarit}</li>)}</ul></div>
              )}
              <p className="text-xs text-faint">Offre dossier : {offre ? 'incluse' : 'non incluse'}. Chaque message est revérifié (opposition, paiement) au moment de partir ; envoi un par un.</p>
              <div className="flex gap-3">
                <button type="button" disabled={phase.tri.eligibles.length === 0} onClick={() => lancer(phase.tri)} className="rounded-full bg-accent px-5 py-2 font-semibold text-bg disabled:opacity-50">Confirmer l&apos;envoi ({phase.tri.eligibles.length})</button>
                <button type="button" onClick={fermer} className="rounded-full border border-border px-4 py-2 text-ivory hover:border-accent">Annuler</button>
              </div>
            </>) : (<>
              <p role="status" className="tabular text-ivory">{phase.faits} / {phase.tri.eligibles.length} envoyés · {phase.echecs.length} échec{phase.echecs.length > 1 ? 's' : ''} · {phase.tri.ecartes.length + phase.ecartsEnVol.length} écartés</p>
              <progress className="w-full" max={phase.tri.eligibles.length} value={phase.faits + phase.echecs.length + phase.ecartsEnVol.length} />
              {phase.etat === 'envoi' && <button type="button" onClick={() => { arret.current = true; }} className="rounded-full border border-border px-4 py-2 text-ivory hover:border-accent">Arrêter (après l&apos;envoi en cours)</button>}
              {phase.etat === 'fini' && (<>
                <p className="text-ivory">{phase.arret ? 'Arrêté avant la fin.' : 'Terminé.'}</p>
                {phase.echecs.length > 0 && <div><p className="mb-1 font-medium text-down">Échecs</p><ul className="space-y-1 text-muted">{phase.echecs.map((e, i) => <li key={i}><span className="text-ivory">{e.nom}</span> — {e.message}</li>)}</ul></div>}
                {phase.ecartsEnVol.length > 0 && <div><p className="mb-1 font-medium text-warn">Écartées au dernier contrôle</p><ul className="space-y-1 text-muted">{phase.ecartsEnVol.map((e, i) => <li key={i}><span className="text-ivory">{e.nom}</span> — {e.message}</li>)}</ul></div>}
                <button type="button" onClick={fermer} className="rounded-full bg-accent px-5 py-2 font-semibold text-bg">Fermer</button>
              </>)}
            </>)}
          </div>
        </div>
      )}
    </>
  );
}
