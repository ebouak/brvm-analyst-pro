/**
 * Pass premium Chariow — décisions PURES (testées : tests/passRappels.test.ts).
 *
 * Un pass n'est pas un abonnement : aucun prélèvement automatique. Le client
 * est prévenu UNE fois, 7 jours avant l'échéance, puis le pass expire
 * (fonction SQL expirer_pass_chariow, migration 0146).
 */

export const PREAVIS_JOURS = 7;

export interface PassActif {
  id: string;
  user_id: string;
  renews_at: string | null;
  rappel_expiration_at: string | null;
  plan: string;
}

/** Pass à rappeler maintenant : échéance dans ≤ 7 jours, pas encore échue, jamais rappelé. */
export function aRappeler(pass: PassActif[], maintenant: Date): PassActif[] {
  const t = maintenant.getTime();
  const limite = t + PREAVIS_JOURS * 24 * 3600 * 1000;
  return pass.filter((p) => {
    if (p.rappel_expiration_at || !p.renews_at) return false;
    const fin = new Date(p.renews_at).getTime();
    return Number.isFinite(fin) && fin > t && fin <= limite;
  });
}

const echapper = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Message de rappel. Aucun montant : le prix vit sur la page de paiement, où
 * il est lu au catalogue — le recopier ici créerait une seconde source à
 * tenir juste.
 */
export function composerRappel(p: { plan: string; echeance: string; lien: string }): {
  sujet: string;
  texte: string;
  html: string;
} {
  const date = new Date(p.echeance).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const sujet = `Votre pass ${p.plan} WestBourse se termine le ${date}`;
  const texte = [
    'Bonjour,',
    '',
    `Votre pass ${p.plan} se termine le ${date}.`,
    'Il ne se renouvelle pas tout seul : aucun prélèvement ne sera fait sans vous.',
    'Pour continuer sans interruption, vous pouvez le prolonger dès maintenant — les jours restants sont conservés :',
    p.lien,
    '',
    'L’équipe WestBourse',
  ].join('\n');
  const html = `<p>Bonjour,</p>
<p>Votre pass <strong>${echapper(p.plan)}</strong> se termine le <strong>${echapper(date)}</strong>.</p>
<p>Il ne se renouvelle pas tout seul : aucun prélèvement ne sera fait sans vous.</p>
<p>Pour continuer sans interruption, vous pouvez le prolonger dès maintenant — les jours restants sont conservés.</p>
<p><a href="${echapper(p.lien)}">Prolonger mon pass</a></p>
<p>L’équipe WestBourse</p>`;
  return { sujet, texte, html };
}
