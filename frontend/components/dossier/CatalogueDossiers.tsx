'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import type { CatalogueDossier } from '@/lib/dossier/catalogue';

const prix = new Intl.NumberFormat('fr-FR').format(1500);

function dateCourte(value: string | null): string {
  if (!value) return 'Date indisponible';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date indisponible';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function Carte({ item, enVedette = false }: { item: CatalogueDossier; enVedette?: boolean }) {
  const statut = item.statut === 'a_jour'
    ? 'Édition disponible'
    : item.statut === 'actualisation'
      ? 'Actualisation requise'
      : 'À paraître';

  return (
    <article className={`dossier-card${enVedette ? ' dossier-card--lead' : ''}`}>
      <Link
        href={`/analyses/dossiers/${item.code}`}
        className="dossier-cover"
        aria-label={`Lire l’aperçu du dossier ${item.designation}`}
      >
        <span className="dossier-cover__edition">WESTBOURSE · RECHERCHE</span>
        <strong>{item.code}</strong>
        <span className="dossier-cover__name">{item.designation}</span>
        <span className="dossier-cover__folio">DOSSIER VALEUR · 9 PAGES</span>
      </Link>
      <div className="dossier-card__body">
        <div className="dossier-card__meta">
          <span>{item.secteur ?? 'BRVM'}</span>
          <span className={`dossier-status dossier-status--${item.statut}`}>{statut}</span>
        </div>
        <h2>{item.designation}</h2>
        <p>
          Identité, trajectoire, valorisation, dividende, risques et niveaux de lecture réunis dans une édition
          produite depuis les données WESTBOURSE.
        </p>
        <div className="dossier-card__bottom">
          <div>
            <span className="dossier-card__date">Mis à jour le {dateCourte(item.dateDossier)}</span>
            <strong>{prix} FCFA</strong>
          </div>
          <Link href={`/analyses/dossiers/${item.code}`} className="dossier-card__link">
            {item.achetable ? 'Lire l’aperçu' : 'Voir le dossier'}
            <ArrowUpRight aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function CatalogueDossiers({ items }: { items: CatalogueDossier[] }) {
  const [recherche, setRecherche] = useState('');
  const [secteur, setSecteur] = useState('tous');
  const secteurs = useMemo(
    () => [...new Set(items.map((item) => item.secteur).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'fr')),
    [items],
  );
  const visibles = useMemo(() => {
    const q = recherche.trim().toLocaleLowerCase('fr');
    return items.filter((item) => {
      const correspond = !q || `${item.code} ${item.designation} ${item.secteur ?? ''}`.toLocaleLowerCase('fr').includes(q);
      return correspond && (secteur === 'tous' || item.secteur === secteur);
    });
  }, [items, recherche, secteur]);

  return (
    <div>
      <div className="dossier-index__filters" role="search">
        <label>
          <Search aria-hidden />
          <span className="sr-only">Rechercher une société</span>
          <input
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
            placeholder="Rechercher une société ou un code"
          />
        </label>
        <label>
          <span className="sr-only">Filtrer par secteur</span>
          <select value={secteur} onChange={(event) => setSecteur(event.target.value)}>
            <option value="tous">Tous les secteurs</option>
            {secteurs.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <p><span className="tabular">{visibles.length}</span> dossiers</p>
      </div>

      {visibles.length === 0 ? (
        <div className="dossier-index__empty">
          <p>Aucun dossier ne correspond à cette recherche.</p>
          <button type="button" onClick={() => { setRecherche(''); setSecteur('tous'); }}>Réinitialiser</button>
        </div>
      ) : (
        <section className="dossier-grid" aria-label="Dossiers valeur disponibles">
          {visibles.map((item, index) => <Carte key={item.code} item={item} enVedette={index === 0} />)}
        </section>
      )}
    </div>
  );
}
