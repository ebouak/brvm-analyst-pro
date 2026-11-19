import type { Metadata } from 'next';
import Link from 'next/link';
import CatalogueDossiers from '@/components/dossier/CatalogueDossiers';
import { chargerCatalogueDossiers } from '@/lib/dossier/catalogueServer';
import './dossiers.css';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Dossiers valeur BRVM — WESTBOURSE Recherche',
  description: 'Dossiers A4 par société cotée : fondamentaux, valorisation, dividende, risques et points de vigilance.',
};

export default async function DossiersIndexPage() {
  const items = await chargerCatalogueDossiers();
  const achetables = items.filter((item) => item.achetable).length;

  return (
    <main className="dossier-index">
      <header className="dossier-masthead">
        <div className="dossier-masthead__top">
          <Link href="/" aria-label="Accueil WESTBOURSE">WESTBOURSE</Link>
          <span>RECHERCHE &amp; VALEUR</span>
          <span>ÉDITION NUMÉRIQUE</span>
        </div>
        <div className="dossier-masthead__rule" />
        <div className="dossier-masthead__lead">
          <div className="dossier-masthead__title">
            <p className="dossier-kicker">Le dossier, société par société</p>
            <h1>Lire une entreprise<br />avant son cours.</h1>
          </div>
          <div className="dossier-masthead__intro">
            <p>
              Neuf pages de faits, de ratios, de trajectoires et de réserves. Deux pages ouvertes à tous ;
              le dossier complet à 1 500 FCFA, ou inclus avec Premium.
            </p>
            <dl>
              <div><dt>Dossiers disponibles</dt><dd className="tabular">{achetables}</dd></div>
              <div><dt>Format</dt><dd>A4 · 9 pages</dd></div>
              <div><dt>Mise à jour</dt><dd>Hebdomadaire</dd></div>
            </dl>
          </div>
        </div>
      </header>

      <CatalogueDossiers items={items} />

      <footer className="dossier-index__footer">
        <p>
          Chaque document distingue les données présentes des données absentes. Les calculs portent leur exercice,
          leur périmètre et leur source. Information financière, sans conseil d’investissement.
        </p>
        <Link href="/methodologie">Lire la méthode WESTBOURSE →</Link>
      </footer>
    </main>
  );
}
