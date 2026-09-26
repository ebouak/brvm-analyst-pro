import { fmtDateFR, fmtNumber } from '@/lib/format';

/**
 * Carnet d'ordres d'une valeur — quantités résiduelles non servies à la clôture.
 *
 * ── Ce que ces chiffres sont, et ne sont pas ──
 * Ce sont les ordres RESTÉS en carnet à la fin de la séance, publiés par la
 * BRVM dans son Bulletin Officiel de la Cote. Ce n'est pas un carnet temps
 * réel, et ce n'est pas la profondeur complète : seule la meilleure limite de
 * chaque côté est publiée. Le bulletin paraît après la clôture, parfois le
 * lendemain — d'où la date affichée en toutes lettres, pour que personne ne
 * lise ces quantités comme l'état du marché à cet instant.
 *
 * ── Pourquoi une barre plutôt que deux nombres ──
 * Le rapport entre les deux côtés est l'information : 12 790 titres à la vente
 * face à rien à l'achat se lit d'un coup d'œil, là où deux nombres alignés
 * demandent un calcul. La barre ENCODE ce rapport ; elle ne porte aucun
 * jugement — un déséquilibre n'est pas un signal d'achat.
 */

export interface CarnetRow {
  date_marche: string;
  qte_achat: number | null;
  cours_achat: number | null;
  qte_vente: number | null;
  cours_vente: number | null;
  achat_au_marche: boolean;
  vente_au_marche: boolean;
  cours_reference: number | null;
}

/** Fourchette en % du milieu. `null` dès qu'un côté manque ou est « au marché ». */
export function spreadPct(c: CarnetRow): number | null {
  if (c.achat_au_marche || c.vente_au_marche) return null;
  const a = c.cours_achat;
  const v = c.cours_vente;
  if (a == null || v == null || a <= 0 || v <= 0 || v < a) return null;
  return ((v - a) / ((v + a) / 2)) * 100;
}

const prix = (c: number | null, auMarche: boolean) =>
  auMarche ? 'au marché' : c == null ? '—' : `${fmtNumber(c)} FCFA`;

export default function CarnetOrdres({ carnet }: { carnet: CarnetRow | null }) {
  if (!carnet) return null;

  const achat = carnet.qte_achat ?? 0;
  const vente = carnet.qte_vente ?? 0;
  const total = achat + vente;
  const partAchat = total > 0 ? (achat / total) * 100 : 0;
  const spread = spreadPct(carnet);

  return (
    <section className="mb-6 rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm text-muted">Carnet d&apos;ordres · quantités résiduelles</h2>
        <span className="text-xs text-faint">clôture du {fmtDateFR(carnet.date_marche)}</span>
      </div>

      {total === 0 ? (
        <p className="py-4 text-center text-sm text-faint">
          Aucun ordre resté en carnet à la clôture de cette séance.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-faint">À l&apos;achat</p>
              <p className="tabular text-xl font-semibold text-up">{achat > 0 ? fmtNumber(achat) : '—'}</p>
              <p className="text-xs text-muted">{achat > 0 ? prix(carnet.cours_achat, carnet.achat_au_marche) : 'aucun acheteur'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-faint">À la vente</p>
              <p className="tabular text-xl font-semibold text-down">{vente > 0 ? fmtNumber(vente) : '—'}</p>
              <p className="text-xs text-muted">{vente > 0 ? prix(carnet.cours_vente, carnet.vente_au_marche) : 'aucun vendeur'}</p>
            </div>
          </div>

          <div
            className="mt-3 flex h-2 overflow-hidden rounded-full bg-elevated"
            role="img"
            aria-label={`${fmtNumber(achat)} titres demandés contre ${fmtNumber(vente)} offerts`}
          >
            <div className="bg-up" style={{ width: `${partAchat}%` }} />
            <div className="bg-down" style={{ width: `${100 - partAchat}%` }} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-faint">Fourchette</dt>
              <dd className="tabular text-ivory">
                {spread == null
                  ? <span className="text-muted">non calculable</span>
                  : `${spread.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`}
              </dd>
            </div>
            <div>
              <dt className="text-faint">Cours de référence</dt>
              <dd className="tabular text-ivory">{carnet.cours_reference != null ? `${fmtNumber(carnet.cours_reference)} FCFA` : '—'}</dd>
            </div>
          </dl>
        </>
      )}

      <p className="mt-3 text-xs text-faint">
        Ordres non servis restés en carnet à la clôture, publiés par la BRVM dans son Bulletin Officiel de la Cote.
        Seule la meilleure limite de chaque côté est publiée : ce n&apos;est ni un carnet temps réel, ni la profondeur
        complète.{spread == null && (carnet.achat_au_marche || carnet.vente_au_marche) ? ' Un ordre « au marché » n’a pas de limite de cours : aucune fourchette ne peut en être tirée.' : ''}
      </p>
    </section>
  );
}
