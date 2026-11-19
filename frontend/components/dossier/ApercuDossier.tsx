import type { ApercuDossier as Apercu } from '@/lib/dossier/apercu';

function date(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return 'Date non disponible';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(parsed);
}

function valeurAffichee(
  valeur: number | null,
  nature: Apercu['pages'][1]['mesures'][number]['nature'],
): string {
  if (valeur == null || !Number.isFinite(valeur)) return 'Non disponible';
  const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
  if (nature === 'pourcent') return `${nombre.format(valeur * 100)} %`;
  if (nature === 'multiple') return `${nombre.format(valeur)} ×`;
  if (nature === 'nombre') return nombre.format(valeur);
  if (Math.abs(valeur) >= 1_000_000_000) return `${nombre.format(valeur / 1_000_000_000)} Md FCFA`;
  return `${nombre.format(valeur)} FCFA`;
}

export default function ApercuDossier({ apercu }: { apercu: Apercu }) {
  const [couverture, chiffres] = apercu.pages;
  return (
    <section className="dossier-apercu" aria-label="Les deux premières pages du dossier">
      <article className="dossier-feuille dossier-feuille--couverture">
        <header>
          <span>WESTBOURSE RECHERCHE</span>
          <span>PAGE {couverture.numero} / 9</span>
        </header>
        <div className="dossier-feuille__cover-copy">
          <p>Dossier valeur</p>
          <strong>{couverture.code}</strong>
          <h2>{couverture.designation}</h2>
          <span>{[couverture.secteur, couverture.pays].filter(Boolean).join(' · ') || 'Bourse régionale'}</span>
        </div>
        <div className="dossier-feuille__cover-bottom">
          <p>Exercice de référence</p>
          <strong>{couverture.exercice ?? 'Non disponible'}</strong>
          <span>Édition du {date(couverture.genereLe)}</span>
        </div>
      </article>

      <article className="dossier-feuille dossier-feuille--chiffres">
        <header>
          <span>{chiffres.designation}</span>
          <span>PAGE {chiffres.numero} / 9</span>
        </header>
        <p className="dossier-feuille__kicker">Les chiffres qui cadrent la lecture</p>
        <dl>
          {chiffres.mesures.map((mesure) => (
            <div key={mesure.libelle}>
              <dt>{mesure.libelle}</dt>
              <dd>{valeurAffichee(mesure.valeur, mesure.nature)}</dd>
            </div>
          ))}
        </dl>
        <footer>
          <p>Une donnée absente reste absente. Aucune estimation n’est ajoutée pour compléter la page.</p>
          <span>Exercice {chiffres.exercice ?? 'non précisé'} · Montants en FCFA</span>
        </footer>
      </article>
    </section>
  );
}
