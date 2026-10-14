/**
 * Agenda des 30 prochains jours — module PUR et testé (spec §4.1).
 *
 * Statuts, dans la forme : `officiel` (paiement lu au Bulletin officiel
 * `brvm-boc`, ou AG publiée sur BDFIN), `annonce` (source tierce ; toutes les
 * dates de détachement, qu'aucune source officielle ne publie), `fermeture`
 * (jour non ouvré du calendrier de marché). Aucune date estimée par nous.
 * Dividende PAR ACTION et TOTAL INDICATIF (quantité détenue aujourd'hui) sont
 * distincts ; la quantité éligible réelle est celle du jour de détachement.
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
export interface AssembleeSource { code: string | null; event_date: string; title: string; source: string | null }
export interface FermetureSource { date: string; holiday_name: string | null }
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

function plusJours(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function construireAgenda(e: {
  aujourdhui: string;
  dividendes: DividendeSource[];
  assemblees: AssembleeSource[];
  fermetures: FermetureSource[];
  positions: PositionAgenda[];
}): ItemAgenda[] {
  const fin = plusJours(e.aujourdhui, HORIZON_JOURS);
  const dansFenetre = (d: string | null): d is string => d != null && d >= e.aujourdhui && d <= fin;

  // Durcissement A : un même code peut être détenu dans plusieurs portefeuilles
  // (on additionne) ; quantités non finies ou <= 0 ignorées.
  const qte = new Map<string, number>();
  for (const p of e.positions) {
    if (!Number.isFinite(p.quantite) || p.quantite <= 0) continue;
    qte.set(p.code, (qte.get(p.code) ?? 0) + p.quantite);
  }

  // Durcissement C : une même échéance peut venir de sources différentes ;
  // on n'en garde qu'une, l'officielle l'emportant (sinon la première vue).
  const items = new Map<string, ItemAgenda>();
  const ajouter = (it: ItemAgenda) => {
    const cle = `${it.type}|${it.code ?? ''}|${it.date}`;
    const existant = items.get(cle);
    if (!existant || (it.statut === 'officiel' && existant.statut !== 'officiel')) items.set(cle, it);
  };

  for (const dv of e.dividendes) {
    // Durcissement B : un montant absent, non fini ou <= 0 n'est jamais affiché (jamais 0).
    if (dv.montant == null || !Number.isFinite(dv.montant) || dv.montant <= 0) continue;
    const baseFiscale: ItemAgenda['baseFiscale'] = dv.base_fiscale === 'net' ? 'net' : dv.base_fiscale === 'brut' ? 'brut' : 'inconnue';
    const q = qte.get(dv.code) ?? null;
    const commun = {
      code: dv.code,
      parAction: dv.montant,
      totalIndicatif: q != null ? q * dv.montant : null,
      baseFiscale,
      mienne: q != null,
      source: dv.source,
    };
    if (dansFenetre(dv.ex_date)) {
      ajouter({ ...commun, date: dv.ex_date, type: 'detachement', statut: 'annonce', titre: `Détachement du dividende ${dv.code}` });
    }
    if (dansFenetre(dv.payment_date)) {
      ajouter({
        ...commun, date: dv.payment_date, type: 'paiement',
        statut: dv.source === 'brvm-boc' ? 'officiel' : 'annonce',
        titre: `Paiement du dividende ${dv.code}`,
      });
    }
  }

  for (const a of e.assemblees) {
    if (!dansFenetre(a.event_date)) continue;
    ajouter({
      date: a.event_date, type: 'assemblee', statut: a.source === 'bdfin' ? 'officiel' : 'annonce',
      code: a.code, titre: a.title, parAction: null, totalIndicatif: null, baseFiscale: 'inconnue',
      mienne: a.code != null && qte.has(a.code), source: a.source,
    });
  }

  for (const f of e.fermetures) {
    if (!dansFenetre(f.date)) continue;
    ajouter({
      date: f.date, type: 'fermeture', statut: 'fermeture', code: null,
      titre: f.holiday_name ? `Bourse fermée : ${f.holiday_name}` : 'Bourse fermée',
      parAction: null, totalIndicatif: null, baseFiscale: 'inconnue', mienne: false, source: 'market_calendar',
    });
  }

  return [...items.values()].sort(
    (x, y) => Number(y.mienne) - Number(x.mienne) || x.date.localeCompare(y.date) || (x.code ?? '').localeCompare(y.code ?? ''),
  );
}
