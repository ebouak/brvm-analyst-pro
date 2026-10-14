/**
 * Agenda des 30 prochains jours — module PUR et testé (spec §4.1).
 *
 * Statuts, dans la forme : `officiel` (paiement lu au Bulletin officiel
 * `brvm-boc`, ou AG dont l'avis vient de la BRVM ou de BDFIN), `annonce` (source tierce ; toutes les
 * dates de détachement, qu'aucune source officielle ne publie), `fermeture`
 * (jour non ouvré du calendrier de marché). Aucune date estimée par nous.
 * Dividende PAR ACTION et TOTAL INDICATIF (quantité détenue aujourd'hui) sont
 * distincts ; la quantité éligible réelle est celle du jour de détachement.
 *
 * `aujourdhui` est la date de marché à Abidjan (UTC+0), au format AAAA-MM-JJ,
 * jamais un horodatage ISO non tronqué. Si elle n'a pas ce format, l'agenda est
 * vide (`[]`) : on ne devine pas la fenêtre. Toute date d'entrée qui n'a pas ce
 * format est exclue, jamais interprétée.
 */
export const HORIZON_JOURS = 30;

export type TypeAgenda = 'detachement' | 'paiement' | 'assemblee' | 'fermeture';
export type StatutAgenda = 'officiel' | 'annonce' | 'fermeture';

export interface DividendeSource {
  code: string;
  montant: number | null;
  ex_date: string | null;
  payment_date: string | null;
  base_fiscale: string | null;
  source: string | null;
}
export interface AssembleeSource {
  code: string | null;
  /**
   * Date de la RÉUNION. Ne jamais y mettre market_events.event_date, qui est la date de
   * publication de l'avis : tant qu'aucune date de réunion n'est disponible, l'appelant
   * passe une liste vide.
   */
  date_reunion: string;
  title: string;
  source: string | null;
}
export interface FermetureSource { date: string; holiday_name: string | null; is_trading_day: boolean }
export interface PositionAgenda { code: string; quantite: number }

export interface ItemAgenda {
  date: string;
  type: TypeAgenda;
  statut: StatutAgenda;
  code: string | null;
  titre: string;
  parAction: number | null;
  totalIndicatif: number | null;
  baseFiscale: 'net' | 'brut' | 'inconnue';
  mienne: boolean;
  source: string | null;
}

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;
const normCode = (c: string): string => c.trim().toUpperCase();

function plusJours(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Source lexicographiquement la plus petite d'abord, null en dernier : départage déterministe.
function sourcePrioritaire(a: string | null, b: string | null): boolean {
  if (a == null) return false;
  if (b == null) return true;
  return a < b;
}

export function construireAgenda(e: {
  aujourdhui: string;
  dividendes: DividendeSource[];
  assemblees: AssembleeSource[];
  fermetures: FermetureSource[];
  positions: PositionAgenda[];
}): ItemAgenda[] {
  if (!FORMAT_DATE.test(e.aujourdhui)) return [];
  const fin = plusJours(e.aujourdhui, HORIZON_JOURS);
  const dansFenetre = (d: string | null): d is string =>
    d != null && FORMAT_DATE.test(d) && d >= e.aujourdhui && d <= fin;

  // Quantités additionnées par valeur ; non finies ou <= 0 ignorées.
  const qte = new Map<string, number>();
  for (const p of e.positions) {
    if (!Number.isFinite(p.quantite) || p.quantite <= 0) continue;
    const c = normCode(p.code);
    qte.set(c, (qte.get(c) ?? 0) + p.quantite);
  }

  // Une échéance par source arrondie au franc ; l'officielle l'emporte (à statut égal, source la plus petite).
  const items = new Map<string, ItemAgenda>();
  const ajouter = (cle: string, it: ItemAgenda) => {
    const ex = items.get(cle);
    const meilleur =
      !ex ||
      (it.statut === 'officiel' && ex.statut !== 'officiel') ||
      (it.statut === ex.statut && sourcePrioritaire(it.source, ex.source));
    if (meilleur) items.set(cle, it);
  };

  for (const dv of e.dividendes) {
    // Montant manquant ou non fini : jamais affiché comme 0.
    if (dv.montant == null || !Number.isFinite(dv.montant) || dv.montant <= 0) continue;
    const code = normCode(dv.code);
    const baseFiscale: ItemAgenda['baseFiscale'] = dv.base_fiscale === 'net' ? 'net' : dv.base_fiscale === 'brut' ? 'brut' : 'inconnue';
    const q = qte.get(code) ?? null;
    const commun = {
      code,
      parAction: dv.montant,
      totalIndicatif: q != null ? Math.round(q * dv.montant * 100) / 100 : null,
      baseFiscale,
      mienne: q != null,
      source: dv.source,
    };
    const franc = Math.round(dv.montant);
    if (dansFenetre(dv.ex_date)) {
      ajouter(`detachement|${code}|${dv.ex_date}|${franc}`, {
        ...commun, date: dv.ex_date, type: 'detachement', statut: 'annonce', titre: `Détachement du dividende ${code}`,
      });
    }
    if (dansFenetre(dv.payment_date)) {
      ajouter(`paiement|${code}|${dv.payment_date}|${franc}`, {
        ...commun, date: dv.payment_date, type: 'paiement',
        statut: dv.source === 'brvm-boc' ? 'officiel' : 'annonce',
        titre: `Paiement du dividende ${code}`,
      });
    }
  }

  for (const a of e.assemblees) {
    if (!dansFenetre(a.date_reunion)) continue;
    const code = a.code != null && a.code.trim() !== '' ? normCode(a.code) : null;
    ajouter(`assemblee|${code ?? a.title}|${a.date_reunion}`, {
      date: a.date_reunion, type: 'assemblee', statut: a.source === 'bdfin' || a.source === 'BRVM' ? 'officiel' : 'annonce',
      code, titre: a.title, parAction: null, totalIndicatif: null, baseFiscale: 'inconnue',
      mienne: code != null && qte.get(code) != null, source: a.source,
    });
  }

  for (const f of e.fermetures) {
    if (f.is_trading_day) continue; // seuls les jours non ouvrés sont des fermetures
    if (!dansFenetre(f.date)) continue;
    // Une fermeture par date : un second libellé de jour férié le même jour est écarté volontairement.
    ajouter(`fermeture||${f.date}`, {
      date: f.date, type: 'fermeture', statut: 'fermeture', code: null,
      titre: f.holiday_name ? `Bourse fermée : ${f.holiday_name}` : 'Bourse fermée',
      parAction: null, totalIndicatif: null, baseFiscale: 'inconnue', mienne: false, source: 'market_calendar',
    });
  }

  return [...items.values()].sort(
    (x, y) =>
      Number(y.mienne) - Number(x.mienne) ||
      x.date.localeCompare(y.date) ||
      (x.code ?? '').localeCompare(y.code ?? '') ||
      x.type.localeCompare(y.type),
  );
}
