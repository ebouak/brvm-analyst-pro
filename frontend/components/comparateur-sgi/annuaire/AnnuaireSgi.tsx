'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, LayoutGrid, List, Mail, Phone, Search } from 'lucide-react';
import { PAYS, type Sgi } from '@/lib/sgi-frais/directory';
import type { SgiFrais } from '@/lib/sgi-frais/types';
import { drapeau, slugSgi } from '@/lib/sgi-frais/identite';
import {
  FILTRES_DEFAUT,
  courtagePublieMax,
  entreesAnnuaire,
  filtrerAnnuaire,
  filtresActifs,
  seuilsCourtage,
  trierAnnuaire,
  type EntreeAnnuaire,
  type FiltresAnnuaire,
  type StatutBareme,
  type TriAnnuaire,
  type TypeSgi,
} from '@/lib/sgi-frais/annuaire';
import { SCENARIO_DEFAUT } from '@/lib/sgi-frais/scenario';
import { fmtFcfa } from '@/lib/sgi-frais/comparaison';

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

export function SgiCard({
  s,
  frais,
  cout,
  meilleur = false,
}: {
  s: Sgi;
  frais?: SgiFrais;
  cout?: Pick<EntreeAnnuaire, 'cout' | 'complet'>;
  /** La moins chère de la sélection (barème complet). */
  meilleur?: boolean;
}) {
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
          className={`rounded-md border px-2 py-1 font-mono text-xs ${
            s.type === 'Banque' ? 'border-accent/25 bg-accent/10 text-accent' : 'border-border bg-elevated/60 text-muted'
          }`}
        >
          {s.type}
        </span>
        <span className="rounded-md border border-border px-2 py-1 font-mono text-xs text-muted">{p.nom}</span>
        {homologue && (
          <span className="rounded-md border border-up/30 bg-up/5 px-2 py-1 font-mono text-xs text-up">Barème homologué</span>
        )}
      </div>

      <dl className="mt-auto grid gap-2.5 border-t border-border pt-3.5 text-[13.5px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-faint">Dépôt min.</dt>
          <dd className="tabular text-[12.5px] font-medium text-ivory">
            {s.depotMin}
            {s.depotMinSource !== 'inconnu' && (
              <span
                className="ml-1 text-[11px] text-faint"
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
                  className={`ml-0.5 text-[11px] ${homologue ? 'text-up' : 'text-faint'}`}
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
              <Phone size={13} strokeWidth={1.75} aria-hidden /> {s.telephone.split('/')[0]!.trim()}
            </a>
          )}
          {s.email && (
            <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1 text-muted transition-colors hover:text-accent" title="Écrire à la SGI">
              <Mail size={13} strokeWidth={1.75} aria-hidden /> e-mail
            </a>
          )}
        </div>
      )}
      {/* Pousse le lien en pied de carte : grilles alignées, quelle que soit la hauteur. */}
      <div aria-hidden className="min-h-3.5 flex-1" />
      {/* Pied de carte : le coût estimé, cliquable vers la fiche. */}
      <Link
        href={`/comparateur-sgi/annuaire/${slugSgi(s)}`}
        className={`group flex min-h-[64px] items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${
          meilleur ? 'border-up/40 bg-up/[0.07] hover:border-up/70' : 'border-border bg-elevated/40 hover:border-accent/40'
        }`}
      >
        <span className="min-w-0">
          <span className="block text-[11.5px] text-faint">{cout ? 'Coût estimé* (scénario de référence)' : 'Fiche détaillée'}</span>
          {cout &&
            (cout.cout == null ? (
              <span className="block text-[14px] text-faint">Sans barème référencé</span>
            ) : (
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className={`tabular font-display text-xl font-bold ${meilleur ? 'text-up' : 'text-ivory'}`}>{fmtFcfa(cout.cout)}</span>
                {!cout.complet && (
                  <span className="text-[11px] text-warn" title="Un poste du barème manque : le coût réel est plus élevé">
                    barème incomplet
                  </span>
                )}
              </span>
            ))}
          <span className="sr-only"> — voir la fiche de {s.nom}</span>
        </span>
        <span
          aria-hidden
          className="grid h-9 w-9 flex-none place-items-center rounded-full border border-accent/40 text-accent transition-colors group-hover:bg-accent group-hover:text-bg"
        >
          <ArrowRight size={16} />
        </span>
      </Link>
    </article>
  );
}

/* ── Annuaire : filtres combinables, tri, coût estimé ─────────────────── */

const BAREMES: { v: StatutBareme; l: string }[] = [
  { v: 'tous', l: 'Tous les barèmes' },
  { v: 'homologue', l: 'Homologué AMF-UMOA' },
  { v: 'agrege', l: 'Agrégé, à confirmer' },
  { v: 'aucun', l: 'Sans barème référencé' },
];
const TYPES: { v: TypeSgi; l: string }[] = [
  { v: 'tous', l: 'Tous les types' },
  { v: 'Banque', l: 'Adossée à une banque' },
  { v: 'Indépendante', l: 'Indépendante' },
];
const TRIS: { v: TriAnnuaire; l: string }[] = [
  { v: 'pays', l: 'Par pays' },
  { v: 'cout', l: 'Coût estimé croissant' },
  { v: 'courtage', l: 'Courtage croissant' },
  { v: 'nom', l: 'Nom (A → Z)' },
];

function Choix({ libelle, valeur, options, onChange }: { libelle: string; valeur: string; options: { v: string; l: string }[]; onChange: (v: string) => void }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[11.5px] text-faint">
      {libelle}
      <select
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[40px] rounded-lg border border-border bg-surface px-2.5 text-[13.5px] text-ivory transition-colors hover:border-accent/40 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/15"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AnnuaireSgi({ directory, frais }: { directory: Sgi[]; frais: SgiFrais[] }) {
  const fraisByNom = useMemo(() => new Map(frais.map((f) => [f.sgiNom, f])), [frais]);
  // Coût estimé de chaque SGI sur le scénario de référence, par le moteur du simulateur.
  const entrees = useMemo(() => entreesAnnuaire(directory, frais, SCENARIO_DEFAUT), [directory, frais]);
  const [f, setF] = useState<FiltresAnnuaire>(FILTRES_DEFAUT);
  const [tri, setTri] = useState<TriAnnuaire>('pays');
  const set = (p: Partial<FiltresAnnuaire>) => setF((x) => ({ ...x, ...p }));
  const list = useMemo(() => trierAnnuaire(filtrerAnnuaire(entrees, f), tri), [entrees, f, tri]);
  const actifs = filtresActifs(f);
  const [vue, setVue] = useState<'grille' | 'liste'>('grille');
  // La moins chère de la sélection affichée, parmi les barèmes complets seulement.
  const meilleurNom = useMemo(
    () => list.filter((e) => e.cout != null && e.complet).sort((a, b) => a.cout! - b.cout!)[0]?.sgi.nom ?? null,
    [list],
  );
  const courtages = useMemo(
    () => [
      { v: 'tous', l: 'Tout courtage' },
      ...seuilsCourtage(entrees).map((t) => ({ v: String(t), l: `Courtage ≤ ${t.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %` })),
    ],
    [entrees],
  );

  // Seuls les pays où une SGI est référencée : un filtre vide serait un piège.
  const paysPresents = useMemo(
    () => (Object.keys(PAYS) as (keyof typeof PAYS)[]).filter((c) => directory.some((s) => s.pays === c)),
    [directory],
  );
  const chips: ('ALL' | keyof typeof PAYS)[] = ['ALL', ...paysPresents];
  const reinitialiser = () => setF(FILTRES_DEFAUT);

  return (
    <div>
      <div className="rounded-panel border border-border bg-surface/60 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] lg:items-end">
          <label className="flex min-w-0 flex-col gap-1 text-[11.5px] text-faint">
            Recherche
            <span className="flex min-h-[40px] items-center gap-2 rounded-lg border border-border bg-surface px-2.5 focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/15">
              <Search size={16} className="flex-none text-faint" aria-hidden />
              <input
                type="search"
                value={f.recherche}
                onChange={(e) => set({ recherche: e.target.value })}
                placeholder="Nom ou groupe…"
                aria-label="Rechercher une SGI par nom ou par groupe"
                className="w-full bg-transparent text-[14px] text-ivory outline-none placeholder:text-faint"
              />
            </span>
          </label>
          <Choix libelle="Barème" valeur={f.bareme} options={BAREMES} onChange={(v) => set({ bareme: v as StatutBareme })} />
          <Choix libelle="Type" valeur={f.type} options={TYPES} onChange={(v) => set({ type: v as TypeSgi })} />
          <Choix
            libelle="Courtage publié"
            valeur={f.courtageMax == null ? 'tous' : String(f.courtageMax)}
            options={courtages}
            onChange={(v) => set({ courtageMax: v === 'tous' ? null : Number(v) })}
          />
          <Choix libelle="Trier" valeur={tri} options={TRIS} onChange={(v) => setTri(v as TriAnnuaire)} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-2 text-[13px] text-muted">
            <input type="checkbox" checked={f.bourseEnLigne} onChange={(e) => set({ bourseEnLigne: e.target.checked })} className="h-4 w-4 accent-accent" />
            Bourse en ligne au barème
          </label>
          {actifs > 0 && (
            <button type="button" onClick={reinitialiser} className="inline-flex min-h-[36px] items-center text-[13px] font-semibold text-accent hover:underline">
              Réinitialiser les filtres ({actifs})
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrer par pays">
        {chips.map((code) => {
          const pressed = f.pays === code;
          // Ce que donnerait un clic, compte tenu des AUTRES filtres actifs.
          const n = filtrerAnnuaire(entrees, { ...f, pays: code }).length;
          return (
            <button
              key={code}
              type="button"
              aria-pressed={pressed}
              disabled={n === 0 && !pressed}
              onClick={() => set({ pays: code })}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-full border px-3.5 font-mono text-[12.5px] font-medium transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${
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

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-faint" aria-live="polite">
          <span className="tabular font-semibold text-ivory">{list.length > 1 ? `${list.length} SGI trouvées` : `${list.length} SGI trouvée`}</span>
          {' · '}*coût estimé hors taxes pour {fmtFcfa(SCENARIO_DEFAUT.montant)} sur un an, {SCENARIO_DEFAUT.nbAchats} achats et {SCENARIO_DEFAUT.nbVentes} ventes,
          frais BRVM et DC/BR compris.
        </p>
        <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Affichage">
          {([
            ['grille', LayoutGrid, 'Grille'],
            ['liste', List, 'Liste'],
          ] as const).map(([v, Icone, libelle]) => (
            <button
              key={v}
              type="button"
              aria-pressed={vue === v}
              aria-label={`Affichage en ${libelle.toLowerCase()}`}
              onClick={() => setVue(v)}
              className={`grid h-9 w-9 place-items-center rounded-md transition-colors ${vue === v ? 'bg-nuit text-sur-nuit' : 'text-muted hover:text-ivory'}`}
            >
              <Icone size={16} aria-hidden />
            </button>
          ))}
        </div>
      </div>

      {list.length > 0 && vue === 'grille' ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => (
            <SgiCard key={e.sgi.nom} s={e.sgi} frais={fraisByNom.get(e.sgi.nom)} cout={e} meilleur={e.sgi.nom === meilleurNom} />
          ))}
        </div>
      ) : list.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-panel border border-border bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Annuaire des SGI en liste</caption>
            <thead>
              <tr className="border-b border-border text-left text-[11px] text-faint">
                <th scope="col" className="px-4 py-3 font-medium">SGI</th>
                <th scope="col" className="px-3 py-3 font-medium">Barème</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Courtage max.</th>
                <th scope="col" className="hidden px-3 py-3 font-medium md:table-cell">Dépôt min.</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Coût estimé*</th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Fiche</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => {
                const top = e.sgi.nom === meilleurNom;
                const c = courtagePublieMax(e.frais);
                return (
                  <tr key={e.sgi.nom} className={`border-b border-border/60 last:border-0 ${top ? 'bg-up/[0.06]' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={drapeau(e.sgi.pays)} alt={PAYS[e.sgi.pays]?.nom ?? ''} width={20} height={13} className="h-[13px] w-5 flex-none rounded-[2px] ring-1 ring-border" />
                        <span className="font-medium text-ivory">{e.sgi.nom}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {e.frais ? (
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                            e.frais.confiance === 'homologue_crepmf' ? 'border-up/30 bg-up/5 text-up' : 'border-border text-muted'
                          }`}
                        >
                          {e.frais.confiance === 'homologue_crepmf' ? 'Homologué' : 'À confirmer'}
                        </span>
                      ) : (
                        <span className="text-[12px] text-faint">Aucun</span>
                      )}
                    </td>
                    <td className="tabular px-3 py-3 text-right text-muted">
                      {c != null ? `${c.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %` : '—'}
                    </td>
                    <td className="tabular hidden px-3 py-3 text-muted md:table-cell">{e.sgi.depotMin}</td>
                    <td className={`tabular px-3 py-3 text-right font-semibold ${top ? 'text-up' : 'text-ivory'}`}>
                      {e.cout != null ? fmtFcfa(e.cout) : <span className="font-normal text-faint">—</span>}
                      {e.cout != null && !e.complet && <span className="block text-[11px] font-normal text-warn">barème incomplet</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/comparateur-sgi/annuaire/${slugSgi(e.sgi)}`}
                        className="inline-flex min-h-[32px] items-center rounded-full border border-accent/40 px-3 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/10"
                      >
                        Fiche
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 rounded-panel border border-dashed border-border px-5 py-14 text-center">
          <p className="text-sm text-muted">Aucune SGI ne correspond à ces critères.</p>
          <button type="button" onClick={reinitialiser} className="mt-3 inline-flex min-h-[36px] items-center text-xs font-semibold text-accent hover:underline">
            Réinitialiser les filtres
          </button>
        </div>
      )}

      <div className="mt-7 rounded-xl border border-border bg-surface px-5 py-4 text-[14px] leading-relaxed text-muted">
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
