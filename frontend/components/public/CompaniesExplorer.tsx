'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import RatingBadge from '@/components/RatingBadge';
import { fmtNumber, fmtPctSigne } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

export interface CompanyCard {
  code: string;
  designation: string;
  secteur: string | null;
  pays: string | null;
  cours: number | null;
  variation_pct: number | null;
  /** Date du dernier cours quand elle précède la séance annoncée en tête de page ; null sinon. */
  cours_au?: string | null;
  score_total: number | null;
  confiance: number | null;
}

/** Sens de variation, pour les liens venus des compteurs de la landing. */
type Sens = 'tous' | 'hausse' | 'baisse' | 'stable';
const LIBELLE_SENS: Record<Exclude<Sens, 'tous'>, string> = {
  hausse: 'En hausse',
  baisse: 'En baisse',
  stable: 'Stables',
};

/**
 * Colonnes de la cote. Une seule définition pour l'en-tête et les lignes, sinon
 * les chiffres décrochent de leur libellé. Sur mobile : nom à gauche, note, puis
 * cours et variation empilés à droite ; à partir de md, six colonnes.
 */
const COLONNES =
  'grid grid-cols-[minmax(0,1fr)_auto_6rem] items-center gap-x-4 md:grid-cols-[4.5rem_minmax(0,1fr)_8.5rem_3rem_7rem_5.5rem]';

/** Valeurs sans secteur en base : regroupées, en dernier, jamais écartées. */
const NON_CLASSE = 'Non classé';

/** « 2026-11-03 » → « 3 nov. 2026 » */
function dateCourte(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Décompte de séance d'un secteur, tiré des lignes visibles, comme dans le
 * bulletin du soir. Même règle que le filtre `sens` : une variation absente
 * n'est comptée nulle part. Rien à dire si aucune ligne n'a de variation.
 */
function decompte(list: CompanyCard[]): string | null {
  let h = 0, b = 0, s = 0;
  for (const c of list) {
    const v = c.variation_pct;
    // Un cours plus ancien porte la variation de SA séance, pas de celle-ci.
    if (v == null || c.cours_au) continue;
    if (v > 0) h++;
    else if (v < 0) b++;
    else s++;
  }
  if (h + b + s === 0) return null;
  return `${h} en hausse, ${b} en baisse, ${s} inchangée${s > 1 ? 's' : ''}`;
}

/** Couleur décidée APRÈS l'arrondi, comme le signe : « 0,00 % » reste neutre. */
function tonVariation(v: number): string {
  const r = Number(v.toFixed(2));
  return r > 0 ? 'text-up' : r < 0 ? 'text-down' : 'text-muted';
}

/** Cote filtrable des sociétés, par secteur (recherche instantanée nom/code/secteur/pays). */
export default function CompaniesExplorer({ companies }: { companies: CompanyCard[] }) {
  const [query, setQuery] = useState('');
  const [sens, setSens] = useState<Sens>('tous');

  // Le filtre arrive par l'URL (`?sens=hausse`), depuis les compteurs de la
  // landing. Lu APRÈS montage, avec `window.location`, et non par
  // `searchParams` côté serveur : cette page est en ISR 900 s, et lire
  // `searchParams` la ferait basculer en rendu dynamique à chaque visite.
  // `useSearchParams` imposerait en plus une frontière Suspense, dont ce dépôt
  // sait le prix (une réponse diffusée en flux part en 200 avant tout 404).
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('sens');
    if (v === 'hausse' || v === 'baisse' || v === 'stable') setSens(v);
  }, []);
  const router = useRouter();
  const supabase = createClient();

  // Le clic sur une ligne n'ouvre plus la fiche publique /societes/CODE : il
  // envoie vers /actions/CODE (connecté) ou vers l'inscription avec ce même
  // /actions/CODE comme destination post-connexion (anonyme). Le `href` réel
  // reste /societes/CODE — laissé intact pour le crawl SEO (Googlebot suit le
  // href, jamais le onClick) ; seule la navigation humaine est interceptée.
  const handleCardClick = (code: string) => async (e: React.MouseEvent) => {
    e.preventDefault();
    const target = `/actions/${code}`;
    const { data: { user } } = await supabase.auth.getUser();
    router.push(user ? target : `/signup?next=${encodeURIComponent(target)}`);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Une variation absente n'est ni une hausse ni une baisse : on ne la range
    // pas d'office dans « stables », ce serait affirmer un chiffre qu'on n'a pas.
    const parSens = sens === 'tous'
      ? companies
      : companies.filter((c) => {
          const v = c.variation_pct;
          // Idem pour un cours antérieur à la séance : sa variation n'est pas
          // celle du jour, l'état vide disant « sur cette séance » mentirait.
          if (v == null || c.cours_au) return false;
          if (sens === 'hausse') return v > 0;
          if (sens === 'baisse') return v < 0;
          return v === 0;
        });
    if (!q) return parSens;
    return parSens.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.designation.toLowerCase().includes(q) ||
        (c.secteur ?? '').toLowerCase().includes(q) ||
        (c.pays ?? '').toLowerCase().includes(q),
    );
  }, [companies, query, sens]);

  const bySector = useMemo(() => {
    const map = new Map<string, CompanyCard[]>();
    for (const c of filtered) {
      const key = c.secteur ?? NON_CLASSE;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    const entrees = [...map.entries()];
    return [
      ...entrees.filter(([k]) => k !== NON_CLASSE),
      ...entrees.filter(([k]) => k === NON_CLASSE),
    ];
  }, [filtered]);

  const filtreActif = query.trim() !== '' || sens !== 'tous';
  const toutAfficher = () => {
    setQuery('');
    setSens('tous');
  };

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      {/* Barre d'outils : filtre local de la cote, distinct de la recherche par description au-dessus */}
      <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <label htmlFor="company-search" className="sr-only">
            Filtrer la cote
          </label>
          <Search size={16} strokeWidth={1.5} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            id="company-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
            placeholder="Nom, code, secteur ou pays"
            className="w-full rounded-lg border border-border bg-bg py-2 pl-9 pr-3 text-sm text-ivory placeholder:text-faint transition-colors focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          {sens !== 'tous' && (
            // Sans cette puce, une personne arrivant depuis la landing verrait
            // une liste tronquée sans savoir pourquoi, ni comment la rouvrir.
            <span className="inline-flex items-center gap-1 rounded-chip border border-border bg-elevated py-1 pl-3 pr-1 text-ivory">
              {LIBELLE_SENS[sens]} sur cette séance
              <button
                type="button"
                onClick={() => setSens('tous')}
                aria-label="Retirer le filtre et afficher toutes les sociétés"
                className="rounded-md p-1 text-muted transition-colors hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <X size={14} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </span>
          )}
          {filtreActif && (
            <p role="status">
              <span className="tabular">{filtered.length}</span> société{filtered.length > 1 ? 's' : ''}
              {query.trim() !== '' && <span className="font-sans"> pour « {query.trim()} »</span>}
            </p>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-muted">
            {query.trim() !== ''
              ? `Aucune société ne correspond à « ${query.trim()} »${sens !== 'tous' ? ` parmi les valeurs ${LIBELLE_SENS[sens].toLowerCase()}` : ''}.`
              : `Aucune société ${sens === 'stable' ? 'stable' : sens === 'hausse' ? 'en hausse' : 'en baisse'} sur cette séance.`}
          </p>
          <button
            type="button"
            onClick={toutAfficher}
            className="mt-4 rounded-lg border border-border px-4 py-2 text-sm text-ivory transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Afficher toute la cote
          </button>
        </div>
      ) : (
        <>
          <div aria-hidden="true" className={`${COLONNES} hidden border-b border-border px-4 py-2 text-xs text-faint md:grid`}>
            <span>Code</span>
            <span>Société</span>
            <span>Pays</span>
            <span>Note</span>
            <span className="text-right">Cours (FCFA)</span>
            <span className="text-right">Variation</span>
          </div>

          {bySector.map(([sector, list], idx) => {
            const titreId = `secteur-${idx}`;
            const seance = decompte(list);
            return (
              <section key={sector} aria-labelledby={titreId}>
                {/* Intertitre de bulletin : un filet, pas un en-tête d'accordéon */}
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border-strong px-4 pb-2 pt-6">
                  <h2 id={titreId} className="font-display text-base text-ivory">
                    {sector}
                  </h2>
                  <p className="text-xs text-faint">
                    <span className="tabular">{list.length}</span> valeur{list.length > 1 ? 's' : ''}
                    {seance && <> · {seance}</>}
                  </p>
                </div>
                <ul className="divide-y divide-border">
                  {list.map((c) => (
                    <li key={c.code}>
                      <Link
                        href={`/societes/${c.code}`}
                        onClick={handleCardClick(c.code)}
                        className={`${COLONNES} min-h-14 px-4 py-3 transition-colors hover:bg-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60`}
                      >
                        <span className="hidden font-mono text-sm font-medium text-ivory md:block">{c.code}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-ivory">{c.designation}</span>
                          <span className="mt-1 block truncate text-xs text-faint md:hidden">
                            <span className="font-mono font-medium text-ivory">{c.code}</span> · {c.pays ?? '—'}
                          </span>
                        </span>
                        <span className="hidden truncate text-sm text-muted md:block">{c.pays ?? '—'}</span>
                        <span className="justify-self-start">
                          <RatingBadge scoreTotal={c.score_total} confiance={c.confiance} neutre />
                        </span>
                        <span className="text-right md:contents">
                          <span className="tabular block text-sm text-ivory md:text-right">
                            {fmtNumber(c.cours)}
                            {c.cours != null && <span className="text-xs text-faint md:hidden"> FCFA</span>}
                            {c.cours != null && c.cours_au && (
                              <span className="block text-xs text-faint">au {dateCourte(c.cours_au)}</span>
                            )}
                          </span>
                          <span
                            className={`tabular mt-1 block text-xs md:mt-0 md:text-right md:text-sm ${
                              c.variation_pct != null && !c.cours_au ? tonVariation(c.variation_pct) : 'text-faint'
                            }`}
                          >
                            {c.variation_pct != null ? fmtPctSigne(c.variation_pct, 2) : '—'}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
