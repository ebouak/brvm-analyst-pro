/**
 * Commandes rapides WhatsApp (lot A, spec docs/superpowers/specs/2026-10-23-whatsapp-lot-a-design.md).
 *
 * Module PUR : reconnaissance d'une commande, mise en forme de la réponse à
 * partir des retours de lib/agent/outils.ts (même source de chiffres que
 * l'agent), statistiques de la console. Aucun accès réseau ni base ici.
 *
 * Une réponse automatique ne recommande rien : ni signal BUY/HOLD/SELL, ni
 * rendement (sa base fiscale n'est pas portée par `dividendes_valeur`).
 */

export type Commande =
  | { type: 'cours'; valeur: string }
  | { type: 'dividendes'; valeur: string }
  | { type: 'palmares'; critere: 'hausses' | 'baisses' | 'volumes' }
  | { type: 'aide' };

export type IssueCommande = 'ok' | 'introuvable' | 'erreur';

const SITE = 'https://www.westbourse.com';
export const LIEN_INSCRIPTION_NUMERO = `${SITE}/signup?next=%2Fparametres%2Falertes`;
const MOTS_MAX = 4;
/** Lettres, chiffres, espace, apostrophes, tiret : ni `%`, ni `_`, ni `,` (filtres PostgREST / LIKE). */
const VALEUR_VALIDE = /^[\p{L}\p{N} '’-]{1,40}$/u;

function sansAccent(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** La commande que porte le message, ou null si c'est une phrase pour l'équipe. */
export function lireCommande(texte: string): Commande | null {
  const propre = texte.trim().replace(/^[/!]\s*/, '').replace(/\s+/g, ' ');
  if (!propre) return null;
  const mots = propre.split(' ');
  if (mots.length > MOTS_MAX) return null;
  const cle = sansAccent(mots[0]);
  const reste = mots.slice(1).join(' ');

  if (['aide', 'menu', 'help', '?'].includes(cle)) return reste ? null : { type: 'aide' };

  if (cle === 'cours' || cle === 'prix' || cle === 'div' || cle === 'dividende' || cle === 'dividendes') {
    if (!reste) return { type: 'aide' };
    if (!VALEUR_VALIDE.test(reste)) return null;
    return { type: cle === 'cours' || cle === 'prix' ? 'cours' : 'dividendes', valeur: reste };
  }

  if (cle === 'palmares' || cle === 'top') {
    if (!reste) return { type: 'palmares', critere: 'hausses' };
    const c = sansAccent(reste);
    if (/^hausses?$/.test(c)) return { type: 'palmares', critere: 'hausses' };
    if (/^baisses?$/.test(c)) return { type: 'palmares', critere: 'baisses' };
    if (/^volumes?$/.test(c)) return { type: 'palmares', critere: 'volumes' };
    return null;
  }
  return null;
}

/* ------------------------------------------------------------ mise en forme */

type Res = Record<string, unknown> | null;

const nombre = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

function dateFr(iso: unknown): string | null {
  const m = typeof iso === 'string' ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

function variation(v: unknown): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '';
  if (v === 0) return '= 0 %';
  return `${v > 0 ? '▲ +' : '▼ -'}${nombre(Math.abs(v))} %`;
}

function capitaux(v: unknown): string | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null;
  if (v >= 1e9) return `${nombre(Math.round(v / 1e8) / 10)} Md FCFA`;
  if (v >= 1e6) return `${nombre(Math.round(v / 1e5) / 10)} M FCFA`;
  return `${nombre(v)} FCFA`;
}

export interface OptionsRendu {
  /** Lien de la Chaîne WhatsApp (lot B) ; la ligne n'apparaît que s'il existe. */
  chaineUrl?: string | null;
}

function pied(o: OptionsRendu): string {
  const lignes = [
    '_Information de marché, pas un conseil en investissement._',
    '',
    '🔔 *Recevez vos alertes ici, sur WhatsApp* : créez votre compte gratuit puis inscrivez votre numéro',
    LIEN_INSCRIPTION_NUMERO,
  ];
  if (o.chaineUrl) lignes.push('', `📣 Rejoignez la Chaîne WESTBOURSE : ${o.chaineUrl}`);
  return lignes.join('\n');
}

const EXEMPLES = '• *COURS SNTS* — cours de la dernière séance\n• *DIV ORAC* — derniers dividendes\n• *PALMARES* — hausses du jour (ou *PALMARES BAISSES*, *PALMARES VOLUMES*)';

function aide(): string {
  return [
    '👋 *Assistant WESTBOURSE*',
    '',
    'Tapez par exemple :',
    EXEMPLES,
    '',
    'Ou écrivez simplement votre question : un membre de l’équipe vous répond.',
  ].join('\n');
}

function introuvable(): string {
  return ['🔎 *Valeur introuvable*', '', 'Indiquez le code ou le nom de la société, par exemple :', EXEMPLES].join('\n');
}

/** Issue d'une commande, pour le journal (sans contenu). */
export function issueCommande(cmd: Commande, res: Res): IssueCommande {
  if (cmd.type === 'aide') return 'ok';
  if (!res) return 'erreur';
  if (typeof res.erreur === 'string') return res.code || cmd.type === 'palmares' ? 'erreur' : 'introuvable';
  return 'ok';
}

function corpsCours(r: Record<string, unknown>): string {
  const lignes = [`📈 *${r.code}${r.societe ? ` — ${r.societe}` : ''}*`, `Séance du ${dateFr(r.seance) ?? '—'}`, ''];
  lignes.push(
    typeof r.cours === 'number'
      ? `💰 Cours : *${nombre(r.cours)} FCFA*  ${variation(r.variation_pct)}`.trimEnd()
      : '💰 Cours : non disponible',
  );
  const vol = typeof r.volume === 'number' ? `${nombre(r.volume)} titres` : null;
  const cap = capitaux(r.valeur_echangee);
  if (vol || cap) lignes.push(`🔁 Volume : ${[vol, cap && `${cap} échangés`].filter(Boolean).join(' · ')}`);
  lignes.push('', `👉 Fiche complète : ${SITE}/actions/${encodeURIComponent(String(r.code))}`);
  return lignes.join('\n');
}

function corpsDividendes(r: Record<string, unknown>): string {
  const divs = Array.isArray(r.dividendes) ? (r.dividendes as Record<string, unknown>[]) : [];
  if (divs.length === 0) {
    return `💵 *${r.code} — Dividendes*\n\nAucun dividende vérifié en base pour cette valeur.\n\n👉 ${SITE}/societes/${encodeURIComponent(String(r.code))}`;
  }
  const lignes = [`💵 *${r.code} — Dividendes*`, ''];
  for (const d of divs.slice(0, 3)) {
    const dates = [
      dateFr(d.detachement) && `détachement ${dateFr(d.detachement)}`,
      dateFr(d.paiement) && `paiement ${dateFr(d.paiement)}`,
    ].filter(Boolean);
    lignes.push(`• Exercice ${d.exercice} : *${d.montant}*${dates.length ? ` — ${dates.join(', ')}` : ''}`);
  }
  lignes.push('', '_Un dividende passé ne préjuge pas des suivants._', '', `👉 Historique complet : ${SITE}/societes/${encodeURIComponent(String(r.code))}`);
  return lignes.join('\n');
}

function corpsPalmares(r: Record<string, unknown>, critere: 'hausses' | 'baisses' | 'volumes'): string {
  const classement = Array.isArray(r.classement) ? (r.classement as Record<string, unknown>[]) : [];
  const lignes = [`🏆 *Palmarès — séance du ${dateFr(r.seance) ?? '—'}*`, `_${r.critere}_`, ''];
  classement.slice(0, 5).forEach((l, i) => {
    const cours = typeof l.cours === 'number' ? `${nombre(l.cours)} FCFA` : '';
    const detail =
      critere === 'volumes' && typeof l.volume === 'number' ? `${nombre(l.volume)} titres` : variation(l.variation_pct);
    lignes.push(`${i + 1}. *${l.code}* ${cours}  ${detail}`.trimEnd());
  });
  if (typeof r.valeurs_cotees === 'number') lignes.push('', `Sur ${r.valeurs_cotees} valeurs cotées.`);
  lignes.push('', 'Tapez aussi *PALMARES BAISSES* ou *PALMARES VOLUMES*.', `👉 Toutes les valeurs : ${SITE}/actions`);
  return lignes.join('\n');
}

/** Texte WhatsApp complet de la réponse à une commande. */
export function rendreCommande(cmd: Commande, res: Res, o: OptionsRendu): string {
  let corps: string;
  if (cmd.type === 'aide') corps = aide();
  else if (!res) corps = '⚠️ Donnée momentanément indisponible. Réessayez dans quelques minutes.';
  else if (typeof res.erreur === 'string') {
    corps =
      issueCommande(cmd, res) === 'introuvable'
        ? introuvable()
        : '⚠️ Donnée momentanément indisponible pour cette valeur. Réessayez plus tard.';
  } else if (cmd.type === 'cours') corps = corpsCours(res);
  else if (cmd.type === 'dividendes') corps = corpsDividendes(res);
  else corps = corpsPalmares(res, cmd.critere);
  return `${corps}\n\n${pied(o)}`.slice(0, 4096);
}

/* --------------------------------------------------------------- statistiques */

export interface StatsWhatsapp {
  recus7: number;
  recus30: number;
  /** Médiane création → réponse sur 30 jours, en heures (1 décimale) ; null sans réponse. */
  delaiMedianHeures: number | null;
}

export function statsWhatsapp(
  messages: { canal: string; created_at: string; repondu_at: string | null }[],
  maintenant: Date,
): StatsWhatsapp {
  const age = (iso: string) => (maintenant.getTime() - new Date(iso).getTime()) / 86400000;
  const wa30 = messages.filter((m) => m.canal === 'whatsapp' && age(m.created_at) <= 30);
  const delais = wa30
    .filter((m) => m.repondu_at)
    .map((m) => (new Date(m.repondu_at as string).getTime() - new Date(m.created_at).getTime()) / 3600000)
    .sort((a, b) => a - b);
  let mediane: number | null = null;
  if (delais.length) {
    const mi = Math.floor(delais.length / 2);
    mediane = delais.length % 2 ? delais[mi] : (delais[mi - 1] + delais[mi]) / 2;
    mediane = Math.round(mediane * 10) / 10;
  }
  return {
    recus7: wa30.filter((m) => age(m.created_at) <= 7).length,
    recus30: wa30.length,
    delaiMedianHeures: mediane,
  };
}
