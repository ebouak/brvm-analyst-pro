'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { PAYS, type Sgi } from '@/lib/sgi-frais/directory';
import type { SgiFrais } from '@/lib/sgi-frais/types';
import { drapeau, slugSgi } from '@/lib/sgi-frais/identite';

/* ── Monogramme de repli (logo absent ou cassé) ─────────────────────────── */

const STOP = new Set([
  'de', 'du', 'des', 'la', 'le', 'et', '&', 'cie', 'capital', 'finance', 'securities',
  'bourse', 'investment', 'corporation', 'management', 'financière',
]);
function monogram(nom: string): string {
  const words = nom.replace(/&/g, ' ').split(/\s+/).filter(Boolean);
  if (/^[A-Z]{2,5}$/.test(words[0])) return words[0].slice(0, 4);
  const sig = words.filter((w) => !STOP.has(w.toLowerCase()));
  const pick = sig.length >= 1 ? sig : words;
  return ((pick[0][0] || '') + (pick[1] ? pick[1][0] : '')).toUpperCase();
}

/* ── Carte SGI ─────────────────────────────────────────────────────────── */

export function SgiCard({ s, frais }: { s: Sgi; frais?: SgiFrais }) {
  const p = PAYS[s.pays];
  // Courtage RÉEL du barème de la SGI (mêmes données que le simulateur).
  const courtageMax = frais?.courtagePctMax ?? frais?.courtagePctMin ?? null;
  const homologue = frais?.confiance === 'homologue_crepmf';
  // « Bourse en ligne » figure dans la grille homologuée (notes du barème) :
  // seul fait vérifié sur ce point — sinon « non renseigné ».
  const bourseEnLigne = frais?.notes?.toLowerCase().includes('bourse en ligne') ?? false;
  const lien = s.ficheBRVM
    ? { href: s.ficheBRVM, label: 'Fiche BRVM' }
    : s.siteWeb
      ? { href: s.siteWeb, label: 'Site officiel' }
      : null;
  return (
    <article className="flex flex-col rounded-panel border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-[0_10px_30px_-18px_rgb(var(--color-accent)/0.45)]">
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {/* Monogramme dessous, logo officiel par-dessus : s'il manque, le monogramme reste. */}
          <span className="relative grid h-11 w-11 flex-none place-items-center overflow-hidden rounded-[11px] border border-border bg-elevated text-accent">
            <span className="font-display text-sm font-bold" aria-hidden>
              {monogram(s.nom)}
            </span>
            {s.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.logo}
                alt={`Logo ${s.nom}`}
                loading="lazy"
                // Logos officiels brvm.org : vignettes 3:2 sur fond blanc.
                className="absolute inset-0 h-full w-full bg-white object-contain p-0.5"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-[1.05rem] leading-tight text-ivory">{s.nom}</h3>
            <p className="mt-1 text-[12.5px] text-muted">{s.groupe}</p>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={drapeau(s.pays)} alt={`Drapeau ${p.nom}`} width={30} height={20} className="h-5 w-[30px] flex-none rounded-[3px] ring-1 ring-border" title={p.nom} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <span
          className={`rounded-md border px-2 py-1 font-mono text-[10.5px] uppercase tracking-wide ${
            s.type === 'Banque' ? 'border-accent/25 bg-accent/10 text-accent' : 'border-border bg-elevated/60 text-muted'
          }`}
        >
          {s.type}
        </span>
        <span className="rounded-md border border-border px-2 py-1 font-mono text-[10.5px] uppercase tracking-wide text-muted">{p.nom}</span>
        {homologue && (
          <span className="rounded-md border border-up/30 bg-up/10 px-2 py-1 font-mono text-[10.5px] uppercase tracking-wide text-up">Barème homologué</span>
        )}
      </div>

      <dl className="mt-auto grid gap-2.5 border-t border-border pt-3.5 text-[13.5px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-faint">Dépôt min.</dt>
          <dd className="tabular text-[12.5px] font-medium text-ivory">
            {s.depotMin}
            {s.depotMinSource !== 'inconnu' && (
              <span
                className="ml-1 text-[10px] text-faint"
                title={s.depotMinSource === 'relevé' ? 'Constaté, à reconfirmer auprès de la SGI' : 'Ordre de grandeur du marché'}
              >
                {s.depotMinSource === 'relevé' ? 'relevé*' : 'indic.'}
              </span>
            )}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-faint">Courtage</dt>
          <dd className="tabular text-[12.5px] font-medium text-ivory">
            {courtageMax != null ? (
              <>
                max {courtageMax.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %{' '}
                <span
                  className={`ml-0.5 text-[10px] ${homologue ? 'text-up' : 'text-faint'}`}
                  title={homologue ? 'Barème homologué AMF-UMOA/CREPMF' : 'Donnée agrégée de sources publiques, à confirmer'}
                >
                  {homologue ? 'homologué' : 'agrégé'}
                </span>
              </>
            ) : (
              <span className="text-faint">non publié</span>
            )}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-faint">Bourse en ligne</dt>
          <dd className="text-[12.5px] font-medium">
            {bourseEnLigne ? (
              <span className="text-up" title="Des frais de bourse en ligne figurent dans la grille tarifaire de la SGI">
                au barème
              </span>
            ) : (
              <span className="text-faint">non renseigné</span>
            )}
          </dd>
        </div>
      </dl>

      {/* Contacter précède l'ouverture d'un compte. N'affiché que si RENSEIGNÉ. */}
      {(lien || s.telephone || s.email) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[11.5px]">
          {lien && (
            <a href={lien.href} rel="nofollow noopener" target="_blank" className="inline-flex items-center gap-1 text-accent transition-colors hover:underline">
              {lien.label} <span aria-hidden>↗</span>
            </a>
          )}
          {s.telephone && (
            <a href={`tel:${s.telephone.split('/')[0]!.replace(/[^+\d]/g, '')}`} className="inline-flex items-center gap-1 text-muted transition-colors hover:text-accent" title="Appeler la SGI">
              <span aria-hidden>☎</span> {s.telephone.split('/')[0]!.trim()}
            </a>
          )}
          {s.email && (
            <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1 text-muted transition-colors hover:text-accent" title="Écrire à la SGI">
              <span aria-hidden>✉</span> e-mail
            </a>
          )}
        </div>
      )}
      {/* Pousse le lien en pied de carte : grilles alignées, quelle que soit la hauteur. */}
      <div aria-hidden className="min-h-3.5 flex-1" />
      <Link
        href={`/comparateur-sgi/annuaire/${slugSgi(s)}`}
        className="inline-flex min-h-[40px] items-center justify-between gap-2 border-t border-border pt-3 text-[13px] font-semibold text-accent transition-colors hover:text-ivory"
      >
        Fiche détaillée
        <ArrowRight size={15} aria-hidden />
      </Link>
    </article>
  );
}

/* ── Annuaire : recherche, filtre pays, grille ──────────────────────────── */

export function AnnuaireSgi({ directory, frais }: { directory: Sgi[]; frais: SgiFrais[] }) {
  const fraisByNom = useMemo(() => new Map(frais.map((f) => [f.sgiNom, f])), [frais]);
  const [filtreP, setFiltreP] = useState<'ALL' | keyof typeof PAYS>('ALL');
  const [recherche, setRecherche] = useState('');

  const list = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return directory
      .filter((s) => (filtreP === 'ALL' || s.pays === filtreP) && (!q || s.nom.toLowerCase().includes(q) || s.groupe.toLowerCase().includes(q)))
      .sort((a, b) => (a.pays === b.pays ? a.nom.localeCompare(b.nom) : a.pays.localeCompare(b.pays)));
  }, [directory, filtreP, recherche]);

  // Seuls les pays où une SGI est référencée : un filtre vide serait un piège.
  const paysPresents = useMemo(
    () => (Object.keys(PAYS) as (keyof typeof PAYS)[]).filter((c) => directory.some((s) => s.pays === c)),
    [directory],
  );
  const chips: ('ALL' | keyof typeof PAYS)[] = ['ALL', ...paysPresents];

  return (
    <div>
      <label className="mb-4 flex max-w-sm items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/15">
        <Search size={17} className="flex-none text-faint" aria-hidden />
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher une SGI…"
          aria-label="Rechercher une SGI par nom ou par groupe"
          className="w-full bg-transparent py-2.5 text-[15px] text-ivory outline-none placeholder:text-faint"
        />
      </label>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par pays">
        {chips.map((code) => {
          const pressed = filtreP === code;
          const n = code === 'ALL' ? directory.length : directory.filter((s) => s.pays === code).length;
          return (
            <button
              key={code}
              type="button"
              aria-pressed={pressed}
              onClick={() => setFiltreP(code)}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-full border px-3.5 font-mono text-[12.5px] font-medium transition-colors active:scale-95 ${
                pressed ? 'border-nuit bg-nuit text-sur-nuit' : 'border-border bg-surface text-muted hover:border-accent/40 hover:text-ivory'
              }`}
            >
              {code !== 'ALL' && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={drapeau(code)} alt="" width={18} height={12} className="h-3 w-[18px] rounded-[2px]" />
              )}
              {code === 'ALL' ? 'Tous les pays' : PAYS[code].nom}
              <span className={pressed ? 'opacity-80' : 'opacity-60'}>{n}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-5 font-mono text-[12.5px] text-faint" aria-live="polite">
        {list.length > 1 ? `${list.length} SGI affichées` : `${list.length} SGI affichée`}
      </p>

      {list.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <SgiCard key={s.nom} s={s} frais={fraisByNom.get(s.nom)} />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-panel border border-dashed border-border px-5 py-14 text-center">
          <p className="text-sm text-muted">Aucune SGI ne correspond à votre recherche.</p>
          <button
            type="button"
            onClick={() => {
              setRecherche('');
              setFiltreP('ALL');
            }}
            className="mt-3 text-xs font-semibold text-accent hover:underline"
          >
            Réinitialiser
          </button>
        </div>
      )}

      <div className="mt-7 rounded-xl border border-border border-l-2 border-l-accent bg-surface px-5 py-4 text-[14px] leading-relaxed text-muted">
        <b className="text-ivory">D&apos;où viennent ces informations.</b> Coordonnées et logos : annuaire officiel
        de la BRVM. Courtage marqué « homologué » : décision d&apos;homologation de l&apos;AMF-UMOA, dont le PDF est lié
        dans le simulateur. « Agrégé » : sources publiques, à confirmer. Dépôts minimums marqués{' '}
        <span className="font-mono text-[12px] text-faint">indic.</span> (ordre de grandeur) ou{' '}
        <span className="font-mono text-[12px] text-faint">relevé*</span> (constaté) : ils ne figurent pas dans les
        décisions, confirmez-les auprès de la SGI. Liste officielle :{' '}
        <a href="https://www.brvm.org/fr/intervenants/sgi/tous" rel="nofollow noopener" target="_blank" className="text-accent hover:underline">
          brvm.org
        </a>
        .
      </div>
    </div>
  );
}
