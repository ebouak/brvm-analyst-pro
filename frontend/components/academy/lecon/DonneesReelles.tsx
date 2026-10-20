import type { DonneesSection } from '@/lib/academy/donneesServer';

/**
 * Exemples RÉELS d'une leçon (bloc `donnees_reelles`), lus en base au
 * chargement (lib/academy/donneesServer.ts). Étiquetés « Données réelles »,
 * datés, sourcés ; une valeur sans donnée est nommée, jamais complétée.
 */

const nombre = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n);
const pct = (n: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n)} %`;
const dateFr = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const SOURCES: Record<string, string> = {
  'brvm-calendrier': 'calendrier de paiement BRVM',
  'brvm-boc': 'Bulletin officiel de la cote (BRVM)',
  richbourse: 'Richbourse',
  sikafinance: 'Sika Finance',
  'sikafinance-societe': 'Sika Finance',
  bdfin: 'BDFIN (BRVM)',
  BRVM: 'BRVM',
};
const libelleSource = (s: string | null) => (s ? SOURCES[s] ?? s : 'source non renseignée');

function Entete({ titre }: { titre: string }) {
  return (
    <div className="lp-figure-tete">
      <p className="lp-figure-titre">{titre}</p>
      <span className="lp-badge lp-badge--reel">Données réelles</span>
    </div>
  );
}

function Manquants({ codes }: { codes: string[] }) {
  if (codes.length === 0) return null;
  return <p className="lp-note">Sans donnée exploitable aujourd’hui : {codes.join(', ')}.</p>;
}

export default function DonneesReelles({ donnees }: { donnees: DonneesSection | null | undefined }) {
  if (!donnees) {
    return (
      <p className="lp-note" role="status">
        Données réelles momentanément indisponibles : la suite de la leçon n’en dépend pas.
      </p>
    );
  }

  if (donnees.vue === 'rendement') {
    const { lignes, dateCours, manquants } = donnees;
    if (lignes.length === 0) return <Manquants codes={manquants} />;
    const actions = lignes[0]?.revenu != null ? Math.round(lignes[0].revenu / lignes[0].dividende) : null;
    const sources = [...new Set(lignes.map((l) => libelleSource(l.source)))];
    const nonVerifiee = lignes.some((l) => !l.baseNette);
    return (
      <figure className="lp-figure">
        <Entete titre="Le même calcul, sur des valeurs de la BRVM" />
        <div className="lp-table-wrap">
          <table className="lp-table">
            <caption className="sr-only">Dernier dividende, cours et rendement de valeurs de la BRVM</caption>
            <thead>
              <tr>
                <th scope="col">Société</th>
                <th scope="col" className="lp-num">Dernier dividende net (FCFA)</th>
                <th scope="col" className="lp-num">Cours (FCFA)</th>
                <th scope="col" className="lp-num">Rendement net</th>
                {actions && <th scope="col" className="lp-num">Pour {nombre(actions)} actions (FCFA)</th>}
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.code}>
                  <th scope="row" className="lp-ligne-tete">
                    {l.nom}
                    <span className="lp-cellule-detail">{l.code}</span>
                  </th>
                  <td className="lp-num">
                    {nombre(l.dividende)}
                    {!l.baseNette && '*'}
                    <span className="lp-cellule-detail">
                      exercice {l.exercice}
                      {l.paiement ? ` · payé le ${dateFr(l.paiement)}` : ''}
                    </span>
                  </td>
                  <td className="lp-num">{nombre(l.cours)}</td>
                  <td className="lp-num">{pct(l.rendementPct)}</td>
                  {actions && <td className="lp-num">{l.revenu != null ? nombre(l.revenu) : '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="lp-hypotheses">
          {dateCours && <li>Cours de clôture de la séance du {dateFr(dateCours)} ; le rendement change avec le cours.</li>}
          <li>Dividendes : {sources.join(', ')}, via la base WestBourse. Les dividendes passés ne préjugent pas des dividendes futurs.</li>
          {nonVerifiee && <li>* Montant publié dont la base (brut ou net) n’est pas vérifiée.</li>}
        </ul>
        <Manquants codes={manquants} />
      </figure>
    );
  }

  const { exercices, lignes, manquants } = donnees;
  if (lignes.length === 0) return <Manquants codes={manquants} />;
  const nonVerifiee = lignes.some((l) => l.montants.some((m) => m.montant != null && !m.baseNette));
  return (
    <figure className="lp-figure">
      <Entete titre={`Dividende par action, exercices ${exercices[0]} à ${exercices[exercices.length - 1]}`} />
      <div className="lp-table-wrap">
        <table className="lp-table">
          <caption className="sr-only">Historique des dividendes par action de valeurs de la BRVM</caption>
          <thead>
            <tr>
              <th scope="col">Société</th>
              {exercices.map((e) => (
                <th key={e} scope="col" className="lp-num">{e}</th>
              ))}
              <th scope="col" className="lp-num">Baisses</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.code}>
                <th scope="row" className="lp-ligne-tete">{l.nom}</th>
                {l.montants.map((m) => (
                  <td key={m.exercice} className="lp-num">
                    {m.montant != null ? nombre(m.montant) : '—'}
                  </td>
                ))}
                <td className={`lp-num${l.baisses > 0 ? ' lp-alerte' : ''}`}>{l.baisses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="lp-hypotheses">
        <li>Montants par action, en FCFA, tels qu’enregistrés dans la base WestBourse ; « — » : aucun dividende enregistré.</li>
        {nonVerifiee && <li>Pour les exercices anciens, la base (brut ou net) de certains montants n’est pas vérifiée.</li>}
      </ul>
      <Manquants codes={manquants} />
    </figure>
  );
}
