/**
 * Gabarits de relance — PURS. N'insèrent QUE des faits du dossier (prénom,
 * date, montant) ; l'exploitant relit et corrige avant d'envoyer. Le pied
 * d'opposition est ajouté À L'ENVOI (le jeton n'existe qu'à ce moment) :
 * art. 21 RGPD, absolu en prospection.
 */
import { fmtFcfa, fmtJour } from './score';
import type { Dossier, Score } from './types';

export type TemplateId = 'paiement_inacheve' | 'offre_consultee' | 'actif_sans_abonnement' | 'prospect_sans_compte';

export function choisirGabarit(d: Dossier, s: Score): TemplateId {
  const codes = new Set(s.raisons.map((r) => r.code));
  if (codes.has('paiement')) return 'paiement_inacheve';
  if (codes.has('offre')) return 'offre_consultee';
  if (!d.userId) return 'prospect_sans_compte';
  return 'actif_sans_abonnement';
}

const SIGNATURE = "L'équipe WESTBOURSE";

export function composerRelance(id: TemplateId, d: Dossier): { sujet: string; corps: string } {
  const prenom = d.nom?.trim().split(/\s+/)[0];
  const bonjour = prenom ? `Bonjour ${prenom},` : 'Bonjour,';
  const paiement = [...d.paiementsEnAttente].sort((a, b) => b.date.localeCompare(a.date))[0];
  switch (id) {
    case 'paiement_inacheve':
      return {
        sujet: 'Votre abonnement Premium WESTBOURSE',
        corps: [
          bonjour,
          '',
          paiement
            ? `Vous aviez commencé votre abonnement Premium le ${fmtJour(paiement.date)}, pour ${fmtFcfa(paiement.montant)}, sans aller jusqu'au bout.`
            : "Vous aviez commencé votre abonnement Premium sans aller jusqu'au bout.",
          "Si quelque chose vous a arrêté (moyen de paiement, question sur l'offre), répondez simplement à ce message : nous vous répondrons personnellement.",
          '',
          SIGNATURE,
        ].join('\n'),
      };
    case 'offre_consultee':
      return {
        sujet: "Une question sur l'offre Premium ?",
        corps: [bonjour, '', "Vous avez récemment regardé l'offre Premium de WESTBOURSE.", 'Si vous avez une question sur ce qu’elle contient, répondez simplement à ce message.', '', SIGNATURE].join('\n'),
      };
    case 'prospect_sans_compte':
      return {
        sujet: 'Votre compte WESTBOURSE',
        corps: [bonjour, '', 'Vous nous aviez laissé vos coordonnées sur WESTBOURSE.', 'Vous pouvez créer votre compte gratuitement sur https://www.westbourse.com/signup ; pour toute question, répondez à ce message.', '', SIGNATURE].join('\n'),
      };
    case 'actif_sans_abonnement':
      return {
        sujet: "Ce que l'offre Premium ajoute",
        corps: [bonjour, '', "Merci d'utiliser WESTBOURSE. L'offre Premium ajoute notamment les signaux expliqués et le diagnostic des sociétés.", 'Si vous voulez en savoir plus, répondez simplement à ce message.', '', SIGNATURE].join('\n'),
      };
  }
}

export function piedOpposition(lien: string): string {
  return `—\nVous ne souhaitez plus recevoir ce type de message ? ${lien}`;
}

export function versHtml(texte: string): string {
  const echappe = texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return echappe.replace(/https:\/\/[^\s<]+/g, (url) => `<a href="${url}">${url}</a>`).replace(/\n/g, '<br>');
}
