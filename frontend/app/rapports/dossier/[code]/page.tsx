import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { buildDossier, type DossierValeur } from '@/lib/dossier/build';
import { construireNarratif } from '@/lib/dossier/narratif';
import { BarresAnnuelles, CourbeCours, BarreDetachement } from '@/components/dossier/Graphiques';
import { fmtFcfa, fmtNumber, fmtDateFR } from '@/lib/format';
import ImprimerDossier from './ImprimerDossier';
import './dossier.css';

/**
 * Dossier valeur — douze panneaux, format A4.
 *
 * PILOTÉ PAR LA DONNÉE, PAS PAR LA PROSE. Le pipeline d'export existant
 * (`/api/export/pdf`) fait rédiger l'IA puis DÉCOUPE son texte : la mise en
 * page dépend donc de ce que le modèle a bien voulu écrire, et un chiffre faux
 * traverse toute la chaîne sans rencontrer d'obstacle. Ici, chaque valeur vient
 * de `buildDossier` (lecture ou fonction pure testée) et chaque appréciation de
 * `construireNarratif` (déterministe, chiffre à l'appui).
 *
 * Aucun appel de modèle de langage n'intervient dans cette page. Le polissage
 * rédactionnel viendra plus tard, sous la même contrainte que
 * `scraper/src/hebdo/polish.ts` : tout chiffre absent de la liste blanche fait
 * rejeter la sortie.
 */

export const dynamic = 'force-dynamic';

const TOTAL_PANNEAUX = 12;
/* Sept feuilles : la sixième (appréciations) et la septième (niveaux et
   réserves) ne tiennent pas ensemble sur un A4 — vérifié sur NEIC, 12 lignes
   d'appréciation plus le tableau des niveaux débordaient de 11 %. */
const TOTAL_FEUILLES = 7;

export async function generateMetadata({ params }: { params: { code: string } }) {
  return { title: `Dossier ${params.code.toUpperCase()}` };
}

// ── Affichage des valeurs ───────────────────────────────────────────────────

/** Une valeur absente s'affiche comme absente. Jamais de zéro de complaisance. */
function Absent({ raison }: { raison?: string }) {
  return (
    <span className="dv-absent" title={raison}>
      non disponible
    </span>
  );
}

const nb = (v: number | null | undefined, d = 0) => (v == null ? null : fmtNumber(v, d));
const cfa = (v: number | null | undefined) => (v == null ? null : `${fmtFcfa(v)} FCFA`);
const pourcent = (v: number | null | undefined, d = 1) =>
  v == null ? null : `${v >= 0 ? '+' : '−'}${fmtNumber(Math.abs(v) * 100, d)} %`;
/** Sans signe : pour les grandeurs qui n'ont pas de sens négatif (payout, part). */
const part = (v: number | null | undefined, d = 1) => (v == null ? null : `${fmtNumber(v * 100, d)} %`);
const fois = (v: number | null | undefined) => (v == null ? null : `${fmtNumber(v, 2)} ×`);

function Mesure({
  libelle,
  valeur,
  note,
  ton,
}: {
  libelle: string;
  valeur: string | null;
  note?: string;
  ton?: 'hausse' | 'baisse';
}) {
  return (
    <div className="dv-mesure">
      <dt>{libelle}</dt>
      <dd className={valeur == null ? undefined : ton === 'hausse' ? 'dv-hausse' : ton === 'baisse' ? 'dv-baisse' : undefined}>
        {valeur ?? <Absent />}
      </dd>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

function Panneau({ n, titre, chapo, children }: { n: number; titre: string; chapo?: string; children: React.ReactNode }) {
  return (
    <section className="dv-panneau">
      <h2 className="dv-titre">
        <span className="dv-numero">{String(n).padStart(2, '0')}</span>
        {titre}
      </h2>
      {chapo ? <p className="dv-chapo">{chapo}</p> : null}
      {children}
    </section>
  );
}

function Feuille({ d, page, children }: { d: DossierValeur; page: number; children: React.ReactNode }) {
  return (
    <article className="dv-page">
      <div className="dv-courant">
        <span>{d.identite.designation ?? d.identite.code}</span>
        <span>Dossier valeur · {d.identite.code}</span>
      </div>
      {children}
      <div className="dv-pied">
        <span>Document d&apos;information — ne constitue pas un conseil en investissement.</span>
        <span>{page} / {TOTAL_FEUILLES}</span>
      </div>
    </article>
  );
}

const VERDICT: Record<string, string> = {
  BUY: 'Indicateurs bien orientés',
  SELL: 'Indicateurs mal orientés',
  HOLD: 'Indicateurs neutres',
};

// ── Page ────────────────────────────────────────────────────────────────────

export default async function DossierPage({ params }: { params: { code: string } }) {
  const sb = createClient();
  const d = await buildDossier(sb, params.code);
  if (!d) notFound();

  const n = construireNarratif(d);
  const { identite: id, chiffres_cles: c, ratios: r, qualite_resultat: q, dividende: div, niveaux: lv } = d;
  const nomComplet = id.designation ?? id.code;

  return (
    <div className="dv">
      <div className="dv-actions">
        <span>
          {TOTAL_PANNEAUX} panneaux sur {TOTAL_FEUILLES} feuilles A4 — chaque chiffre est lu en base ou calculé, aucun n&apos;est rédigé.
        </span>
        <ImprimerDossier />
      </div>

      {/* ── Feuille 1 · Couverture ─────────────────────────────────────── */}
      <article className="dv-page dv-page--couverture">
        <div>
          <p className="dv-marque">Westbourse · Dossier valeur</p>
          <h1 className="dv-couv-titre">{nomComplet}</h1>
          <p className="dv-couv-code">
            {id.code}
            {id.secteur ? ` · ${id.secteur}` : ''}
            {id.pays ? ` · ${id.pays}` : ''}
          </p>

          <div className="dv-couv-cours">
            <span className="dv-couv-prix">{nb(c.cours) ?? '—'}</span>
            <span>
              FCFA
              {c.variation_veille_pct != null && (
                <>
                  {' · '}
                  <strong className={c.variation_veille_pct >= 0 ? 'dv-hausse' : 'dv-baisse'}>
                    {c.variation_veille_pct >= 0 ? '+' : '−'}
                    {fmtNumber(Math.abs(c.variation_veille_pct), 2)} %
                  </strong>
                </>
              )}
              <br />
              <small>Clôture du {fmtDateFR(c.date_cours)}</small>
            </span>
          </div>
        </div>

        <Panneau
          n={1}
          titre="Ce que dit ce dossier"
          chapo="Les douze panneaux qui suivent sont construits à partir de la base : cotations, états financiers, dividendes et signaux. Rien n'y est estimé."
        >
          <dl className="dv-grille">
            <Mesure
              libelle="Exercice couvert"
              valeur={c.exercice}
              note="Dernier exercice dont les états financiers sont en base."
            />
            <Mesure
              libelle="Séances analysées"
              valeur={d.technique.serie.length > 0 ? `${d.technique.serie.length}` : null}
              note="Clôtures réelles, zéros de collecte exclus."
            />
            <Mesure
              libelle="Lecture technique"
              valeur={d.technique.signal ? (VERDICT[d.technique.signal] ?? d.technique.signal) : null}
              note={
                d.technique.date_signal
                  ? `Signal du ${fmtDateFR(d.technique.date_signal)}. Mesure de tendance, pas une recommandation.`
                  : "Aucun signal calculé pour cette valeur."
              }
            />
            <Mesure
              libelle="Points non établis"
              valeur={`${d.lacunes.length}`}
              note="Détaillés au panneau 12 plutôt que laissés en blanc."
            />
          </dl>
        </Panneau>

        <p className="dv-chapo" style={{ margin: 0 }}>
          Établi le {fmtDateFR(d.genere_le)} · Document d&apos;information. Il ne constitue ni un conseil en
          investissement, ni une recommandation d&apos;achat ou de vente.
        </p>
      </article>

      {/* ── Feuille 2 · Identité et chiffres clés ──────────────────────── */}
      <Feuille d={d} page={2}>
        <Panneau n={2} titre="L'entreprise en bref">
          <dl className="dv-grille">
            <Mesure libelle="Secteur" valeur={id.secteur} />
            <Mesure libelle="Pays" valeur={id.pays} />
            <Mesure libelle="Actions en circulation" valeur={nb(id.actions)} />
            <Mesure
              libelle="Titres au flottant"
              valeur={nb(id.flottant)}
              note={
                id.flottant != null && id.actions != null
                  ? `Soit ${fmtNumber((id.flottant / id.actions) * 100, 1)} % du capital.`
                  : undefined
              }
            />
            <Mesure
              libelle="Notation"
              valeur={id.notation?.note ?? null}
              note={
                id.notation?.note
                  ? `${id.notation.agence ?? 'Agence non précisée'}${
                      id.notation.perspective ? `, perspective ${id.notation.perspective}` : ''
                    }. Mesure la qualité de crédit, pas la valorisation de l'action.`
                  : undefined
              }
            />
            <Mesure
              libelle="Capitalisation"
              valeur={cfa(c.capitalisation)}
              note="Cours × actions en circulation."
            />
          </dl>
        </Panneau>

        <Panneau
          n={3}
          titre={`Chiffres clés${c.exercice ? ` — exercice ${c.exercice}` : ''}`}
          chapo="Montants tels que publiés par la société, repris des états financiers en base."
        >
          <dl className="dv-grille">
            <Mesure libelle="Chiffre d'affaires" valeur={cfa(c.chiffre_affaires)} />
            <Mesure
              libelle="Résultat net"
              valeur={cfa(c.resultat_net)}
              ton={c.resultat_net == null ? undefined : c.resultat_net >= 0 ? 'hausse' : 'baisse'}
            />
            <Mesure libelle="Capitaux propres" valeur={cfa(c.capitaux_propres)} />
            <Mesure libelle="Dette" valeur={cfa(c.dette)} />
            <Mesure
              libelle="Croissance du CA"
              valeur={pourcent(c.croissance_ca_1an)}
              ton={c.croissance_ca_1an == null ? undefined : c.croissance_ca_1an >= 0 ? 'hausse' : 'baisse'}
              note={
                c.croissance_ca_2ans != null
                  ? `Sur deux exercices : ${pourcent(c.croissance_ca_2ans)}.`
                  : 'Sur un exercice.'
              }
            />
            <Mesure
              libelle="Capitaux propres, variation"
              valeur={pourcent(c.variation_capitaux_propres_1an)}
              ton={
                c.variation_capitaux_propres_1an == null
                  ? undefined
                  : c.variation_capitaux_propres_1an >= 0
                    ? 'hausse'
                    : 'baisse'
              }
              note="Sur un exercice."
            />
          </dl>
        </Panneau>
      </Feuille>

      {/* ── Feuille 3 · Trajectoire et valorisation ────────────────────── */}
      <Feuille d={d} page={3}>
        <Panneau
          n={4}
          titre="Trajectoire des résultats"
          chapo="Chiffre d'affaires et résultat net par exercice, à la même échelle : les deux sont en FCFA, la comparaison est directe."
        >
          <BarresAnnuelles points={d.trajectoire} />
        </Panneau>

        <Panneau
          n={5}
          titre="Valorisation"
          chapo="Ce que le marché paie aujourd'hui pour les résultats et les capitaux propres publiés."
        >
          <dl className="dv-grille">
            <Mesure libelle="Bénéfice par action" valeur={nb(r?.bpa, 2)} note="Résultat net ÷ actions en circulation." />
            <Mesure libelle="PER" valeur={fois(r?.per)} note="Cours ÷ bénéfice par action." />
            <Mesure libelle="Cours / capitaux propres" valeur={fois(r?.pb)} />
            <Mesure libelle="Cours / chiffre d'affaires" valeur={fois(r?.ps)} />
            <Mesure
              libelle="Rentabilité des capitaux propres"
              valeur={part(r?.roe)}
              ton={r?.roe == null ? undefined : r.roe >= 0 ? 'hausse' : 'baisse'}
            />
            <Mesure libelle="Marge nette" valeur={part(r?.margeNette)} />
            <Mesure libelle="Endettement / capitaux propres" valeur={part(r?.gearing)} />
            <Mesure libelle="Rentabilité de l'actif" valeur={part(r?.roa)} note="Approchée : capitaux propres + dette." />
          </dl>
        </Panneau>
      </Feuille>

      {/* ── Feuille 4 · Qualité du résultat et dividende ───────────────── */}
      <Feuille d={d} page={4}>
        <Panneau
          n={6}
          titre="D'où vient le bénéfice"
          chapo="Un résultat net ne dit pas s'il est reproductible. Ce panneau sépare ce qui vient de l'exploitation de ce qui vient d'ailleurs."
        >
          {q ? (
            <>
              <dl className="dv-grille">
                <Mesure libelle="Résultat d'exploitation" valeur={cfa(q.resultat_exploitation)} />
                <Mesure libelle="Résultat avant impôts" valeur={cfa(q.resultat_avant_impots)} />
                <Mesure libelle="Marge d'exploitation" valeur={part(q.marge_exploitation)} />
                <Mesure
                  libelle="Part non opérationnelle"
                  valeur={part(q.part_non_operationnelle)}
                  ton={
                    q.part_non_operationnelle == null
                      ? undefined
                      : q.part_non_operationnelle > 0.5
                        ? 'baisse'
                        : 'hausse'
                  }
                  note="Fraction du résultat avant impôts qui ne provient pas de l'activité."
                />
              </dl>
              {q.part_non_operationnelle != null && q.part_non_operationnelle > 0.5 && (
                <div className="dv-encadre dv-encadre--reserve" style={{ marginTop: '3mm' }}>
                  <h3>À lire avec prudence</h3>
                  <p style={{ margin: 0 }}>
                    Plus de la moitié du résultat avant impôts ({part(q.part_non_operationnelle)}) ne vient pas de
                    l&apos;exploitation. Rien ne garantit que cette part se reproduise l&apos;exercice suivant : le
                    bénéfice publié ne peut pas être projeté tel quel.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="dv-vide">
              Le compte de résultat détaillé n&apos;est pas en base pour cette société : l&apos;origine du bénéfice ne
              peut pas être établie.
            </p>
          )}
        </Panneau>

        <Panneau n={7} titre="Dividende">
          {div.montant != null && div.montant > 0 ? (
            <>
              <dl className="dv-grille">
                <Mesure
                  libelle="Dernier dividende"
                  valeur={`${fmtNumber(div.montant, 2)} FCFA`}
                  note={
                    div.base_fiscale === 'net'
                      ? "Montant NET : l'IRVM de 12 % est déjà retenu à la source."
                      : div.base_fiscale === 'brut'
                        ? 'Montant BRUT, avant retenue de 12 % au titre de l’IRVM.'
                        : `La source « ${div.source ?? 'inconnue'} » ne précise pas si ce montant est brut ou net.`
                  }
                />
                <Mesure libelle="Exercice" valeur={div.exercice != null ? String(div.exercice) : null} />
                <Mesure libelle="Détachement" valeur={div.ex_date ? fmtDateFR(div.ex_date) : null} />
                <Mesure libelle="Mise en paiement" valeur={div.payment_date ? fmtDateFR(div.payment_date) : null} />
                <Mesure
                  libelle="Rendement"
                  valeur={part(div.rendement, 2)}
                  note={
                    div.base_fiscale === 'net'
                      ? 'Rendement net du cours actuel.'
                      : div.base_fiscale === 'brut'
                        ? 'Rendement brut du cours actuel.'
                        : 'Base fiscale inconnue : ce taux est incertain à hauteur de 12 %.'
                  }
                />
                <Mesure
                  libelle="Taux de distribution"
                  valeur={part(div.payout)}
                  note={
                    div.base_fiscale === 'net'
                      ? "Rapporte un dividende net à un bénéfice brut : minoré d'environ 12 %."
                      : 'Part du résultat net distribuée.'
                  }
                />
              </dl>

              {div.historique.length > 0 && (
                <div className="dv-tableau-cadre" style={{ marginTop: '4mm' }}>
                  <table className="dv-tableau">
                    <caption className="dv-chapo" style={{ captionSide: 'top', textAlign: 'left' }}>
                      Historique par exercice, zéros compris — l&apos;irrégularité est une information, pas un trou.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Exercice</th>
                        <th scope="col">Dividende (FCFA)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {div.historique.map((h) => (
                        <tr key={`${h.exercice}`}>
                          <td>{h.exercice}</td>
                          <td className="dv-num">
                            {h.montant == null ? '—' : h.montant === 0 ? 'Aucun' : fmtNumber(h.montant, 2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <p className="dv-vide">
              Aucun dividende strictement positif enregistré pour cette valeur : rendement et taux de distribution ne
              sont pas calculables.
            </p>
          )}
        </Panneau>
      </Feuille>

      {/* ── Feuille 5 · Détachement et cours ───────────────────────────── */}
      <Feuille d={d} page={5}>
        <Panneau
          n={8}
          titre="La journée de détachement"
          chapo="Le jour où le dividende se détache, le cours baisse mécaniquement du montant versé. Tout ce qui dépasse est un mouvement de marché — et se dit comme tel."
        >
          {d.detachement ? (
            <>
              <dl className="dv-grille">
                <Mesure libelle="Séance" valeur={fmtDateFR(d.detachement.ex_date)} />
                <Mesure libelle="Veille" valeur={`${fmtNumber(d.detachement.cours_veille)} FCFA`} />
                <Mesure libelle="Clôture du jour" valeur={`${fmtNumber(d.detachement.cours_ex)} FCFA`} />
                <Mesure
                  libelle="Part expliquée"
                  valeur={part(d.detachement.part_expliquee)}
                  ton={
                    d.detachement.part_expliquee == null
                      ? undefined
                      : d.detachement.part_expliquee >= 0.9
                        ? 'hausse'
                        : 'baisse'
                  }
                  note="Fraction de la baisse imputable au seul détachement."
                />
              </dl>
              <div style={{ marginTop: '4mm' }}>
                <BarreDetachement baisse={d.detachement.baisse_fcfa} dividende={d.detachement.dividende} />
              </div>
              {d.detachement.recul_hors_dividende != null && d.detachement.recul_hors_dividende < 0 && (
                <div className="dv-encadre dv-encadre--reserve" style={{ marginTop: '3mm' }}>
                  <h3>Au-delà du détachement</h3>
                  <p style={{ margin: 0 }}>
                    Une fois la référence ajustée du dividende, il subsiste un recul de{' '}
                    <strong>{part(Math.abs(d.detachement.recul_hors_dividende), 2)}</strong>. Ce mouvement-là n&apos;est
                    pas un ajustement technique : il vient du marché.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="dv-vide">
              Aucune date de détachement ne coïncide avec une séance cotée disponible : la décomposition ne peut pas
              être faite.
            </p>
          )}
        </Panneau>

        <Panneau
          n={9}
          titre="Cours et niveaux"
          chapo={`Clôtures réelles sur ${d.technique.serie.length} séances. Support et résistance sont les bornes du canal des 20 séances précédentes — aucun niveau n'est saisi à la main.`}
        >
          <CourbeCours serie={d.technique.serie} niveaux={lv} />
          <dl className="dv-grille" style={{ marginTop: '3mm' }}>
            <Mesure libelle="Support" valeur={lv ? `${fmtNumber(lv.support, 2)} FCFA` : null} />
            <Mesure libelle="Résistance" valeur={lv ? `${fmtNumber(lv.resistance, 2)} FCFA` : null} />
            <Mesure libelle="RSI (14)" valeur={nb(d.technique.rsi, 1)} />
            <Mesure
              libelle="MACD"
              valeur={nb(d.technique.macd_line, 2)}
              note={d.technique.macd_signal != null ? `Ligne de signal : ${fmtNumber(d.technique.macd_signal, 2)}.` : undefined}
            />
          </dl>
        </Panneau>
      </Feuille>

      {/* ── Feuille 6 · Appréciation ───────────────────────────────────── */}
      <Feuille d={d} page={6}>
        <Panneau
          n={10}
          titre="Points d'appui"
          chapo="Chaque ligne porte le chiffre qui la fonde. Une appréciation sans mesure n'en est pas une."
        >
          {n.forces.length > 0 ? (
            <ul className="dv-liste dv-liste--forces">
              {n.forces.map((a) => (
                <li key={a.texte}>
                  <span>{a.texte}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dv-vide">
              Aucun point d&apos;appui mesurable ne ressort des données disponibles. Cela ne signifie pas qu&apos;il
              n&apos;y en a pas : voir les points non établis, panneau 12.
            </p>
          )}
        </Panneau>

        <Panneau n={11} titre="Points de vigilance">
          {n.risques.length > 0 ? (
            <ul className="dv-liste dv-liste--risques">
              {n.risques.map((a) => (
                <li key={a.texte}>
                  <span>{a.texte}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dv-vide">
              Aucun point de vigilance mesurable ne ressort des données disponibles. L&apos;absence de signal n&apos;est
              pas une absence de risque.
            </p>
          )}
        </Panneau>
      </Feuille>

      {/* ── Feuille 7 · Niveaux et réserves ────────────────────────────── */}
      <Feuille d={d} page={7}>
        <Panneau
          n={12}
          titre="Niveaux et réserves"
          chapo="Les objectifs ci-dessous sont des extensions géométriques du canal, pas des prévisions. Ils disent où le mouvement porterait s'il se prolongeait, rien de plus."
        >
          {lv ? (
            <div className="dv-tableau-cadre">
              <table className="dv-tableau">
                <thead>
                  <tr>
                    <th scope="col">Niveau</th>
                    <th scope="col">Cours (FCFA)</th>
                    <th scope="col">Écart au dernier cours</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Extension haussière 2', lv.objectif2],
                    ['Extension haussière 1', lv.objectif1],
                    ['Résistance', lv.resistance],
                    ['Dernière clôture', lv.dernier],
                    ['Support', lv.support],
                    ['Invalidation', lv.invalidation],
                  ].map(([nom, v]) => {
                    const val = v as number;
                    const ecart = lv.dernier === 0 ? null : (val - lv.dernier) / lv.dernier;
                    return (
                      <tr key={nom as string}>
                        <td>{nom as string}</td>
                        <td className="dv-num">{fmtNumber(val, 2)}</td>
                        <td className={`dv-num ${ecart == null || ecart === 0 ? '' : ecart > 0 ? 'dv-hausse' : 'dv-baisse'}`}>
                          {ecart == null ? '—' : pourcent(ecart)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="dv-vide">
              Moins de 22 séances cotées disponibles : aucun canal ne peut être établi, donc aucun niveau.
            </p>
          )}

          <div className="dv-encadre dv-encadre--reserve" style={{ marginTop: '4mm' }}>
            <h3>Ce que ce dossier ne dit pas</h3>
            {d.lacunes.length > 0 ? (
              <ul>
                {d.lacunes.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0 }}>
                Toutes les données attendues sont présentes pour cette valeur. Les limites générales de la méthode
                restent valables : le carnet d&apos;ordres n&apos;est pas publié par la BRVM, et les états financiers
                sont annuels.
              </p>
            )}
          </div>

          <p className="dv-chapo" style={{ marginTop: '4mm', marginBottom: 0 }}>
            Établi le {fmtDateFR(d.genere_le)} à partir des données Westbourse. Document d&apos;information : il ne
            constitue ni un conseil en investissement, ni une recommandation d&apos;achat ou de vente, et ne tient
            compte ni de votre situation ni de vos objectifs.
          </p>
        </Panneau>
      </Feuille>
    </div>
  );
}
