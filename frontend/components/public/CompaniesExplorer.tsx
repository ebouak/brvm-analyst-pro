'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import RatingBadge from '@/components/RatingBadge';
import { fmtNumber } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

export interface CompanyCard {
  code: string;
  designation: string;
  secteur: string | null;
  pays: string | null;
  cours: number | null;
  variation_pct: number | null;
  score_total: number | null;
  confiance: number | null;
}

/** Annuaire filtrable des sociétés (recherche instantanée nom/code/secteur/pays). */
/** Sens de variation, pour les liens venus des compteurs de la landing. */
type Sens = 'tous' | 'hausse' | 'baisse' | 'stable';
const LIBELLE_SENS: Record<Exclude<Sens, 'tous'>, string> = {
  hausse: 'En hausse',
  baisse: 'En baisse',
  stable: 'Stables',
};

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

  // Le clic sur une carte n'ouvre plus la fiche publique /societes/CODE : il
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
          if (v == null) return false;
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
      const key = c.secteur ?? 'Autres';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [filtered]);

  return (
    <div>
      <div className="mb-6">
        <label htmlFor="company-search" className="sr-only">
          Rechercher une société
        </label>
        <input
          id="company-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher : SONATEL, banque, Sénégal…"
          className="w-full md:max-w-md bg-surface border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/40 transition-colors"
        />
        {sens !== 'tous' && (
          // Sans cette puce, une personne arrivant depuis la landing verrait
          // une liste tronquée sans savoir pourquoi, ni comment la rouvrir.
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-accent-ink">
              {LIBELLE_SENS[sens]}
              <button
                type="button"
                onClick={() => setSens('tous')}
                aria-label="Retirer le filtre et afficher toutes les sociétés"
                className="font-semibold hover:opacity-70"
              >
                ×
              </button>
            </span>
            <span>sur cette séance</span>
          </p>
        )}
        {query && (
          <p className="mt-2 text-xs text-muted" role="status">
            {filtered.length} résultat{filtered.length > 1 ? 's' : ''} pour « {query} »
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center">
          <p className="text-muted text-sm">Aucune société ne correspond à « {query} ».</p>
        </div>
      ) : (
        [...bySector.entries()].map(([sector, list]) => (
          <section key={sector} className="mb-8">
            <h2 className="text-sm text-muted uppercase tracking-wide mb-3">{sector}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map((c) => {
                const positive = (c.variation_pct ?? 0) >= 0;
                return (
                  <Link
                    key={c.code}
                    href={`/societes/${c.code}`}
                    onClick={handleCardClick(c.code)}
                    className="bg-surface border border-border rounded-xl p-4 hover:border-accent/40 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate group-hover:text-accent transition-colors">
                          {c.designation}
                        </p>
                        <p className="text-[11px] text-faint">
                          {c.code} · {c.pays ?? 'UEMOA'}
                        </p>
                      </div>
                      <RatingBadge scoreTotal={c.score_total} confiance={c.confiance} />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="tabular text-lg text-white">
                        {fmtNumber(c.cours)} <span className="text-[11px] text-faint">FCFA</span>
                      </span>
                      {c.variation_pct != null && (
                        <span className={`tabular text-xs font-medium ${positive ? 'text-up' : 'text-down'}`}>
                          {positive ? '+' : ''}
                          {fmtNumber(c.variation_pct, 2)} %
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
