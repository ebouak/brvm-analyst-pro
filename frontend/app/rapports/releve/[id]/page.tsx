import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { chargerReleveAutorise } from '@/lib/server/releveAcces';
import { chargerReactions } from '@/lib/server/reactionsPublications';
import { RESERVE_REACTION } from '@/lib/reactionPublication';
import { fmtDateCourte } from '@/lib/format';
import { Feuille, Panneau, ChiffreGeant, Mesures } from '@/components/document/Document';
import type { DividendeReleve, ReleveJson } from '@/lib/releve/types';
import {
  LIGNES_PAR_FEUILLE, LIBELLE_BASE, decouper, fcfa, libelleMois, lireReleve, nombreDeFeuilles,
  pointsSignes, pourcent, pourcentSigne, tonVariation,
} from '@/lib/releve/affichage';
import ImprimerReleve from './ImprimerReleve';
import '@/components/document/document.css';
import './releve.css';

/**
 * Relevé mensuel du portefeuille — document A4, rendu serveur.
 *
 * DONNÉES PRIVÉES. Accès : le propriétaire connecté, ou le worker d'impression
 * muni d'un jeton à usage unique (voir `lib/server/releveAcces.ts`). Tout autre
 * cas : 404, sans rien révéler. Jamais de cache (`noStore`, `force-dynamic`, et
 * `Cache-Control: no-store` posé par le middleware).
 *
 * Cette page ne lit QUE `report_json`, le document figé à la génération, plus
 * des cours de marché PUBLICS pour mesurer la réaction aux publications
 * (contrat commun `reactionPublication`). Aucune lecture de `portfolios_positions`.
 * Aucun chiffre n'est calculé ici : seuls des formats et des phrases dérivées.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Relevé mensuel',
  // Aucun moteur ne doit indexer ni mettre en cache un relevé, même par erreur de lien.
  robots: { index: false, follow: false, nocache: true },
};

const nonDispo = <span className="doc-absent">non disponible</span>;
const classeTon = (t: 'hausse' | 'baisse' | null) => (t === 'hausse' ? 'rl-hausse' : t === 'baisse' ? 'rl-baisse' : undefined);

function phraseConstat(r: ReleveJson): string {
  const sujet = r.type === 'simule' ? 'Le portefeuille simulé' : 'Votre portefeuille';
  const mois = libelleMois(r.mois);
  const v = r.resume.variation_pct;
  if (v == null) return `La valeur du portefeuille n’est pas disponible pour ${mois}`;
  const t = tonVariation(v);
  if (t == null) return `${sujet} est stable en ${mois}`;
  return `${sujet} ${t === 'hausse' ? 'progresse' : 'recule'} de ${pourcent(Math.abs(v), 2)} en ${mois}`;
}

function libelleDividendeBase(d: DividendeReleve): string {
  return LIBELLE_BASE[d.base_fiscale];
}

function ResumeTotal({ titre, t }: { titre: string; t: { montant: number | null; base: string | null; nb: number } }) {
  if (t.nb === 0) return <p className="rl-resume"><strong>{titre} :</strong> aucun.</p>;
  if (t.montant == null) {
    return (
      <p className="rl-resume">
        <strong>{titre} :</strong> {t.nb} ligne{t.nb > 1 ? 's' : ''}, pas de total : les bases fiscales diffèrent d’une ligne à l’autre.
      </p>
    );
  }
  return (
    <p className="rl-resume">
      <strong>{titre} :</strong> {fcfa(t.montant)} FCFA {t.base ? LIBELLE_BASE[t.base as keyof typeof LIBELLE_BASE] : ''} sur {t.nb} ligne{t.nb > 1 ? 's' : ''}.
    </p>
  );
}

export default async function RelevePage(props: { params: Promise<{ id: string }> }) {
  noStore();
  const { id } = await props.params;
  const acces = await chargerReleveAutorise(id);
  if (!acces) notFound();

  const r = lireReleve(acces.report_json);
  if (!r) {
    return (
      <div className="doc">
        <div className="rl-erreur" role="alert">
          <p>
            Ce relevé est dans un ancien format, ou son contenu n’est pas lisible. Il n’a pas de version imprimable.
          </p>
          <p><Link href="/premium/reports">Retour à mes relevés</Link></p>
        </div>
      </div>
    );
  }

  /* Réaction du cours à chaque publication : contrat commun, données de marché
     publiques. Une lecture qui échoue est dite (« non disponible »), jamais
     remplacée par un zéro. */
  let reactions: Awaited<ReturnType<typeof chargerReactions>> | null = null;
  const demandes = [...new Map(r.publications.liste.map((p) => [`${p.code}|${p.date}`, { code: p.code, date: p.date }])).values()];
  if (demandes.length > 0) {
    try {
      reactions = await chargerReactions(createClient(), demandes);
    } catch {
      reactions = null;
    }
  }

  const L = LIGNES_PAR_FEUILLE;
  const total = nombreDeFeuilles(r);
  const mois = libelleMois(r.mois);
  const entete = `${r.titre} · ${mois} · édition du ${fmtDateCourte(r.genere_le)}`;
  let page = 0;
  const feuille = (enfants: React.ReactNode) => {
    page += 1;
    return (
      <Feuille key={`f${page}`} entete={entete} societe={r.type === 'simule' ? 'Portefeuille simulé' : 'Portefeuille'} page={page} total={total}>
        {enfants}
      </Feuille>
    );
  };

  const lignesTable: ({ kind: 'ligne'; l: ReleveJson['lignes'][number] } | { kind: 'exclue'; e: ReleveJson['exclues'][number] })[] = [
    ...r.lignes.map((l) => ({ kind: 'ligne' as const, l })),
    ...r.exclues.map((e) => ({ kind: 'exclue' as const, e })),
  ];
  const tranchesLignes = decouper(lignesTable, L.positions);

  const rowsDiv = r.dividendes
    ? [
        ...r.dividendes.detaches.map((d) => ({ evenement: 'Détachement', date: d.ex_date, d })),
        ...r.dividendes.encaisses.map((d) => ({ evenement: 'Paiement', date: d.payment_date, d })),
      ]
    : [];
  const tranchesDiv = decouper(rowsDiv, L.dividendes);
  const tranchesPub = decouper(r.publications.liste, L.publications);
  const tranchesRdv = decouper(r.rendez_vous, L.rendezVous);

  const pageDividendes = 1 + tranchesLignes.length + 1;

  const feuilles: React.ReactNode[] = [];

  // ── Synthèse ────────────────────────────────────────────────────────────
  const concentration = r.concentration;
  feuilles.push(feuille(
    <Panneau titre={phraseConstat(r)}>
      <ChiffreGeant
        valeur={fcfa(r.resume.valeur_fin)}
        unite="FCFA"
        legende={r.resume.valeur_fin != null
          ? `Valeur du portefeuille à la fin de ${mois}${r.derniere_seance ? `, au dernier cours connu (séance du ${fmtDateCourte(r.derniere_seance)})` : ''}.`
          : null}
      />
      <Mesures
        items={[
          { libelle: 'Valeur au départ', valeur: r.resume.valeur_depart != null ? `${fcfa(r.resume.valeur_depart)} FCFA` : null },
          {
            libelle: 'Variation du mois',
            valeur: r.resume.variation != null
              ? `${r.resume.variation > 0 ? '+' : r.resume.variation < 0 ? '−' : ''}${fcfa(Math.abs(r.resume.variation))} FCFA`
              : null,
            note: pourcentSigne(r.resume.variation_pct) ?? undefined,
          },
          {
            libelle: 'Lignes valorisées',
            valeur: String(r.resume.nb_lignes),
            note: r.resume.nb_exclues > 0 ? `${r.resume.nb_exclues} exclue${r.resume.nb_exclues > 1 ? 's' : ''} des totaux` : undefined,
          },
          {
            libelle: 'Première ligne',
            valeur: concentration.premiere_ligne ? `${concentration.premiere_ligne.code} · ${pourcent(concentration.premiere_ligne.poids_pct, 1)}` : null,
            note: concentration.premiere_ligne ? 'du portefeuille' : undefined,
          },
          {
            libelle: 'Premier secteur',
            valeur: concentration.premier_secteur ? `${concentration.premier_secteur.secteur} · ${pourcent(concentration.premier_secteur.poids_pct, 1)}` : null,
            note: concentration.sans_secteur_pct != null
              ? `${pourcent(concentration.sans_secteur_pct, 1)} sans secteur renseigné`
              : concentration.premier_secteur ? 'du portefeuille' : undefined,
          },
        ]}
      />
      <p className="doc-note">
        La variation est une variation de cours : elle n’inclut pas les dividendes
        {r.dividendes ? ` (page ${pageDividendes}).` : '.'}
        {r.resume.nb_exclues > 0 ? ` Les lignes sans cours exploitable sont exclues des totaux et nommées page 2.` : ''}
      </p>
      {r.type === 'simule' && (
        <p className="doc-note">
          Vous n’avez pas enregistré de position réelle : ce relevé porte sur votre portefeuille simulé. Le simulateur ne crédite aucun dividende ; ils ne figurent donc pas ici.
        </p>
      )}
      <p className="doc-note">
        Chaque nombre est calculé à partir des cours de clôture de la BRVM et de vos positions à la date de génération du relevé. Aucun n’est estimé.
      </p>
    </Panneau>,
  ));

  // ── Lignes ──────────────────────────────────────────────────────────────
  tranchesLignes.forEach((tranche, i) => {
    const derniere = i === tranchesLignes.length - 1;
    feuilles.push(feuille(
      <section>
        <h2 className="doc-titre-constat rl-titre">Contribution de chaque ligne</h2>
        <p className="rl-chapo">
          La contribution est la part de la ligne dans la variation du portefeuille, en points de pourcentage. Lignes classées par valeur de fin de mois.
        </p>
        {tranche.length === 0 ? (
          <p className="rl-vide">Aucune ligne à afficher.</p>
        ) : (
          <table className="rl-table">
            <thead>
              <tr>
                <th style={{ width: '31%' }}>Valeur</th>
                <th className="rl-n" style={{ width: '11%' }}>Quantité</th>
                <th className="rl-n" style={{ width: '14%' }}>Cours</th>
                <th className="rl-n" style={{ width: '17%' }}>Valeur fin de mois</th>
                <th className="rl-n" style={{ width: '14%' }}>Variation</th>
                <th className="rl-n" style={{ width: '13%' }}>Contribution</th>
              </tr>
            </thead>
            <tbody>
              {tranche.map((row) =>
                row.kind === 'ligne' ? (
                  <tr key={row.l.code}>
                    <td>
                      <strong>{row.l.code}</strong>
                      <small>
                        {row.l.designation}
                        {row.l.poids_pct != null ? ` · ${pourcent(row.l.poids_pct, 1)}` : ''}
                        {row.l.ouverte_dans_mois ? ' · ouverte dans le mois' : ''}
                        {row.l.soldee_dans_mois ? ' · clôturée dans le mois' : ''}
                      </small>
                    </td>
                    <td className="rl-n">{fcfa(row.l.quantite)}</td>
                    <td className="rl-n">
                      {fcfa(row.l.cours_fin)}
                      {row.l.date_cours < r.debut ? <small>au {fmtDateCourte(row.l.date_cours)}</small> : null}
                    </td>
                    <td className="rl-n">{fcfa(row.l.valeur_fin)}</td>
                    <td className={`rl-n ${classeTon(tonVariation(row.l.variation_pct ?? row.l.variation)) ?? ''}`}>
                      {pourcentSigne(row.l.variation_pct) ?? nonDispo}
                      <small>{row.l.variation > 0 ? '+' : row.l.variation < 0 ? '−' : ''}{fcfa(Math.abs(row.l.variation))}</small>
                    </td>
                    <td className="rl-n">{pointsSignes(row.l.contribution_pts) ?? nonDispo}</td>
                  </tr>
                ) : (
                  <tr key={`x-${row.e.code}`} className="rl-exclue">
                    <td>
                      <strong>{row.e.code}</strong>
                      <small>{row.e.designation}</small>
                    </td>
                    <td colSpan={5}>Exclue des totaux : {row.e.motif}.</td>
                  </tr>
                ),
              )}
            </tbody>
            {derniere && r.resume.valeur_fin != null && (
              <tfoot>
                <tr>
                  <td colSpan={3}>Total des lignes valorisées</td>
                  <td className="rl-n">{fcfa(r.resume.valeur_fin)}</td>
                  <td className={`rl-n ${classeTon(tonVariation(r.resume.variation_pct)) ?? ''}`}>{pourcentSigne(r.resume.variation_pct) ?? nonDispo}</td>
                  <td className="rl-n">{pointsSignes(r.resume.variation_pct) ?? nonDispo}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </section>,
    ));
  });

  // ── Dividendes (relevé réel seulement) ─────────────────────────────────
  if (r.dividendes) {
    const dv = r.dividendes;
    tranchesDiv.forEach((tranche, i) => {
      feuilles.push(feuille(
        <section>
          <h2 className="doc-titre-constat rl-titre">Dividendes du mois</h2>
          {i === 0 && (
            <>
              <ResumeTotal titre="Détachés dans le mois" t={dv.total_detaches} />
              <ResumeTotal titre="Encaissés dans le mois" t={dv.total_encaisses} />
            </>
          )}
          {tranche.length === 0 ? (
            <p className="rl-vide">Aucun dividende détaché ni encaissé en {mois} pour les valeurs détenues.</p>
          ) : (
            <table className="rl-table">
              <thead>
                <tr>
                  <th style={{ width: '16%' }}>Date</th>
                  <th style={{ width: '27%' }}>Valeur</th>
                  <th style={{ width: '17%' }}>Événement</th>
                  <th className="rl-n" style={{ width: '14%' }}>Par action</th>
                  <th className="rl-n" style={{ width: '12%' }}>Quantité</th>
                  <th className="rl-n" style={{ width: '14%' }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {tranche.map((row) => (
                  <tr key={`${row.evenement}-${row.d.code}-${row.d.exercice ?? 'x'}`}>
                    <td>{fmtDateCourte(row.date)}</td>
                    <td><strong>{row.d.code}</strong><small>{row.d.designation}{row.d.exercice ? ` · exercice ${row.d.exercice}` : ''}</small></td>
                    <td>{row.evenement}</td>
                    <td className="rl-n">{fcfa(row.d.montant_par_action)}<small>{libelleDividendeBase(row.d)}</small></td>
                    <td className="rl-n">{fcfa(row.d.quantite)}</td>
                    <td className="rl-n">{fcfa(row.d.montant_total) ?? nonDispo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {i === tranchesDiv.length - 1 && (
            <p className="doc-note">
              Montant = dividende par action × quantité détenue la veille du détachement. La base fiscale (net, brut) est celle publiée pour chaque ligne ; aucun impôt n’est retiré ni ajouté, et les montants de bases différentes ne sont pas additionnés.
            </p>
          )}
        </section>,
      ));
    });
  }

  // ── Publications ───────────────────────────────────────────────────────
  tranchesPub.forEach((tranche, i) => {
    feuilles.push(feuille(
      <section>
        <h2 className="doc-titre-constat rl-titre">Publications des sociétés détenues</h2>
        {tranche.length === 0 ? (
          <p className="rl-vide">Aucune publication des sociétés détenues en {mois}.</p>
        ) : (
          <table className="rl-table">
            <thead>
              <tr>
                <th style={{ width: '14%' }}>Date</th>
                <th style={{ width: '20%' }}>Valeur</th>
                <th style={{ width: '44%' }}>Publication</th>
                <th className="rl-n" style={{ width: '22%' }}>Réaction du cours</th>
              </tr>
            </thead>
            <tbody>
              {tranche.map((p) => {
                const reac = reactions?.get(`${p.code}|${p.date}`);
                return (
                  <tr key={`${p.code}-${p.date}-${p.titre}`}>
                    <td>{fmtDateCourte(p.date)}</td>
                    <td><strong>{p.code}</strong><small>{p.designation}</small></td>
                    <td><span className="rl-clamp">{p.titre}</span>{p.type ? <small>{p.type}</small> : null}</td>
                    <td className="rl-n">
                      {!reac ? nonDispo
                        : reac.enCours ? <span className="doc-absent">en cours</span>
                        : reac.ecartIndicePct == null ? <span className="doc-absent">non mesurable</span>
                        : <>{pourcentSigne(reac.ecartIndicePct, 1)}<small>écart à l’indice</small></>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {i === tranchesPub.length - 1 && (
          <>
            {r.publications.non_listees > 0 && (
              <p className="doc-note">{r.publications.non_listees} publication{r.publications.non_listees > 1 ? 's' : ''} supplémentaire{r.publications.non_listees > 1 ? 's' : ''} non listée{r.publications.non_listees > 1 ? 's' : ''}.</p>
            )}
            <p className="doc-note">{RESERVE_REACTION}</p>
          </>
        )}
      </section>,
    ));
  });

  // ── Rendez-vous du mois suivant ────────────────────────────────────────
  tranchesRdv.forEach((tranche, i) => {
    feuilles.push(feuille(
      <section>
        <h2 className="doc-titre-constat rl-titre">Rendez-vous du mois suivant</h2>
        {tranche.length === 0 ? (
          <p className="rl-vide">Aucun détachement, paiement de dividende ni assemblée générale connu le mois suivant pour les valeurs détenues.</p>
        ) : (
          <table className="rl-table">
            <thead>
              <tr>
                <th style={{ width: '17%' }}>Date</th>
                <th style={{ width: '30%' }}>Valeur</th>
                <th style={{ width: '31%' }}>Événement</th>
                <th className="rl-n" style={{ width: '22%' }}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {tranche.map((x) => (
                <tr key={`${x.type}-${x.code}-${x.date}`}>
                  <td>{fmtDateCourte(x.date)}</td>
                  <td><strong>{x.code}</strong><small>{x.designation}</small></td>
                  <td>{x.libelle}</td>
                  <td className="rl-n">
                    {x.montant_total != null ? <>{fcfa(x.montant_total)} FCFA<small>{x.base_fiscale ? LIBELLE_BASE[x.base_fiscale] : ''}</small></>
                      : x.montant_par_action != null ? <>{fcfa(x.montant_par_action)} par action<small>{x.base_fiscale ? LIBELLE_BASE[x.base_fiscale] : ''}</small></>
                      : <span className="doc-absent">sans objet</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {i === tranchesRdv.length - 1 && (
          <p className="doc-note">
            Dates connues à la génération du relevé, d’après le calendrier officiel des dividendes et celui des assemblées publiés par la BRVM. Un événement non annoncé à cette date n’y figure pas.
          </p>
        )}
      </section>,
    ));
  });

  return (
    <div className="doc" data-total-feuilles={total}>
      <div className="rl-actions">
        <Link href="/premium/reports">‹ Mes relevés</Link>
        <ImprimerReleve />
      </div>
      {feuilles}
    </div>
  );
}
