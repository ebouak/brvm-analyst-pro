'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { RaisonRepli, ReponseRecherche } from '@/lib/recherche/types';
import { Sequenceur } from '@/lib/recherche/sequenceur';

const EXEMPLES = [
  'une banque qui verse un dividende',
  'une valeur liquide des télécoms',
  'société sénégalaise en hausse sur un an',
  'industriel hors Côte d’Ivoire',
];

const RAISONS: Record<RaisonRepli, string> = {
  non_connecte: 'Recherche simple. Connectez-vous pour la recherche intelligente.',
  offre_non_eligible: 'Recherche simple : la recherche intelligente n’est pas incluse dans votre offre.',
  quota_atteint: 'Recherche simple : limite horaire de recherches intelligentes atteinte.',
  plafond_atteint: 'Recherche simple : la recherche intelligente est momentanément indisponible.',
  compteur_indisponible: 'Recherche simple : la recherche intelligente est momentanément indisponible.',
  jev_indisponible: 'Recherche simple : la recherche intelligente n’a pas répondu à temps.',
  donnees_indisponibles: 'Les données des sociétés sont momentanément indisponibles.',
};

const ERREURS: Record<string, string> = {
  longueur: 'Décrivez votre recherche en 3 à 150 caractères.',
  donnee_personnelle: 'Retirez les adresses e-mail et numéros de téléphone : ils ne sont jamais envoyés.',
  interne: 'La recherche a échoué. Réessayez dans un instant.',
};

const dateFr = (iso: string) => iso.split('-').reverse().join('/');

export function RechercheSocietes({ retour = '/societes', className = 'mb-8' }: { retour?: string; className?: string } = {}) {
  const [q, setQ] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [reponse, setReponse] = useState<ReponseRecherche | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const sequence = useRef(new Sequenceur());
  const requete = useRef<AbortController | null>(null);

  async function lancer(texte: string) {
    const t = texte.trim();
    if (t.length < 3) {
      setErreur(ERREURS.longueur!);
      return;
    }
    requete.current?.abort();
    const ctrl = new AbortController();
    requete.current = ctrl;
    const id = sequence.current.suivante();
    setEnCours(true);
    setErreur(null);
    try {
      const r = await fetch('/api/recherche-societes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: t }),
        signal: ctrl.signal,
      });
      const corps = (await r.json()) as ReponseRecherche & { erreur?: string };
      if (!sequence.current.estCourante(id)) return; // une recherche plus récente a été lancée
      if (!r.ok) {
        setReponse(null);
        setErreur(ERREURS[corps.erreur ?? 'interne'] ?? ERREURS.interne!);
      } else {
        setReponse(corps);
      }
    } catch (e) {
      if (sequence.current.estCourante(id) && !(e instanceof DOMException && e.name === 'AbortError')) setErreur(ERREURS.interne!);
    } finally {
      if (sequence.current.estCourante(id)) setEnCours(false);
    }
  }

  return (
    <section aria-labelledby="titre-recherche" className={`${className} rounded-panel border border-border bg-surface p-5 md:p-6`}>
      <h2 id="titre-recherche" className="font-display text-lg text-ivory">
        Décrivez la société que vous cherchez
      </h2>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void lancer(q);
        }}
      >
        <label className="flex min-h-[44px] flex-1 items-center gap-2 rounded-xl border border-border bg-bg px-3 focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/15">
          <Search size={17} aria-hidden className="flex-none text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={150}
            placeholder="ex. une banque qui verse un dividende"
            aria-label="Décrivez la société que vous cherchez"
            className="w-full bg-transparent py-2.5 text-[15px] text-ivory outline-none placeholder:text-faint"
          />
        </label>
        <button
          type="submit"
          disabled={enCours}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-bg transition hover:brightness-110 active:scale-95 disabled:opacity-60"
        >
          {enCours ? 'Recherche…' : 'Rechercher'}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXEMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setQ(ex);
              void lancer(ex);
            }}
            className="min-h-[36px] rounded-full border border-border px-3 text-[12.5px] text-muted transition-colors hover:border-accent/40 hover:text-ivory"
          >
            {ex}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="mt-4">
        {erreur && <p className="text-sm text-warn">{erreur}</p>}
        {reponse && (
          <>
            {reponse.raison === 'non_connecte' ? (
              // Invitation AVANT la réponse : la recherche simple reste visible dessous.
              <div className="mb-4 rounded-xl border border-accent/30 bg-accent/[0.06] p-4">
                <p className="font-medium text-ivory">Connectez-vous à WESTBOURSE pour la recherche intelligente</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">
                  Elle comprend votre phrase et classe les sociétés d’après leurs faits. En attendant, voici une recherche simple.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/login?next=${encodeURIComponent(retour)}`}
                    className="inline-flex min-h-[40px] items-center rounded-full bg-accent px-4 text-[13px] font-semibold text-bg transition hover:brightness-110 active:scale-95"
                  >
                    Se connecter
                  </Link>
                  <Link
                    href={`/signup?next=${encodeURIComponent(retour)}`}
                    className="inline-flex min-h-[40px] items-center rounded-full border border-border px-4 text-[13px] font-semibold text-ivory transition-colors hover:border-accent/40 hover:text-accent"
                  >
                    Créer un compte gratuit
                  </Link>
                </div>
              </div>
            ) : (
              reponse.raison && <p className="mb-3 text-[13px] text-muted">{RAISONS[reponse.raison]}</p>
            )}
            {reponse.statut === 'aucune' ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
                Aucune société ne correspond clairement à cette recherche.
              </p>
            ) : (
              <ol className="space-y-2.5">
                {reponse.resultats.map((r) => (
                  <li key={r.code} className="rounded-xl border border-border bg-bg/40 p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <Link href={`/societes/${r.code}`} className="font-medium text-ivory hover:text-accent">
                        {r.nom} <span className="tabular text-[12px] text-faint">{r.code}</span>
                      </Link>
                      <span className="flex items-center gap-2" title="Pertinence estimée">
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-border" aria-hidden>
                          <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(r.score * 100)}%` }} />
                        </span>
                        <span className="tabular text-[12px] text-muted">{Math.round(r.score * 100)} %</span>
                      </span>
                    </div>
                    {r.faits.length > 0 && (
                      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{r.faits.map((f) => `${f.libelle} : ${f.valeur}`).join(' · ')}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-3 text-[11px] text-faint">
              Classement par pertinence{reponse.mode === 'jev' ? ' (Jev, TypeSafe)' : ''}, pas une recommandation d’investissement.
              {reponse.actualiseLe ? ` Données de la séance du ${dateFr(reponse.actualiseLe)}.` : ''}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
