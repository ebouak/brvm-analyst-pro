/**
 * Gabarits de relance — PURS. N'insèrent QUE des faits du dossier (prénom,
 * date, montant) ; l'exploitant relit et corrige avant d'envoyer. Le pied
 * d'opposition est ajouté À L'ENVOI (le jeton n'existe qu'à ce moment) :
 * art. 21 RGPD, absolu en prospection.
 */
import { fmtMontant, fmtJour, compareIso } from './score';
import type { Dossier, Score } from './types';

export const TEMPLATE_IDS = ['paiement_inacheve', 'offre_consultee', 'actif_sans_abonnement', 'prospect_sans_compte', 'formation_gratuite'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export function estTemplateId(v: unknown): v is TemplateId {
  return typeof v === 'string' && (TEMPLATE_IDS as readonly string[]).includes(v);
}

export function choisirGabarit(d: Dossier, s: Score): TemplateId {
  const codes = new Set(s.raisons.map((r) => r.code));
  if (codes.has('paiement')) return 'paiement_inacheve';
  // Jamais à qui a déjà acheté la formation (complète ou en niveaux) : on ne lui revend pas ce qu'il possède.
  // Intérêt pour la formation (pages consultées ou leçons suivies) : on vend la formation complète.
  if (!d.premium && d.userId && !d.formationAchetee && (codes.has('formation') || codes.has('academy'))) return 'formation_gratuite';
  if (codes.has('offre')) return 'offre_consultee';
  if (!d.userId) return 'prospect_sans_compte';
  return 'actif_sans_abonnement';
}

const SIGNATURE = "L'équipe WESTBOURSE";

export function composerRelance(id: TemplateId, d: Dossier): { sujet: string; corps: string } {
  const prenom = d.nom?.trim().split(/\s+/)[0];
  const bonjour = prenom ? `Bonjour ${prenom},` : 'Bonjour,';
  const paiement = [...d.paiementsEnAttente].sort((a, b) => compareIso(b.date, a.date))[0];
  switch (id) {
    case 'paiement_inacheve':
      return {
        sujet: 'Votre abonnement Premium WESTBOURSE',
        corps: [
          bonjour,
          '',
          paiement
            ? `Vous aviez commencé votre abonnement Premium le ${fmtJour(paiement.date)}, pour ${fmtMontant(paiement.montant, paiement.devise)}, sans aller jusqu'au bout.`
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
    case 'formation_gratuite':
      return {
        // Contenu = ce que vend réellement la page d'achat (OffresNiveaux) : quatre niveaux,
        // examens, certificats, accès à vie, un mois de Premium (migration 0156). Aucun prix ni
        // chiffre ici : ils vivent sur la page d'achat et ne doivent pas se périmer dans un e-mail.
        sujet: 'Après la leçon gratuite : la formation complète de l’Academy',
        corps: [
          bonjour,
          '',
          "Vous avez commencé la formation gratuite de l'Academy WESTBOURSE, et nous espérons qu'elle vous a été utile.",
          '',
          'La formation complète va plus loin, à votre rythme :',
          '• les quatre niveaux, de débutant à expert, leçon après leçon ;',
          '• des quiz pour vérifier ce que vous retenez ;',
          '• un examen par niveau et un certificat vérifiable à la clé ;',
          '• un accès à vie à ce contenu (hors refonte majeure ultérieure : un niveau refondu plus d’un an après l’achat se rachète à prix réduit ; vos certificats restent acquis).',
          '',
          'Son achat vous offre aussi un mois de Premium sur toute la plateforme (screener, alertes, lecture de séance, valorisation).',
          '',
          'Découvrir la formation complète : https://www.westbourse.com/formations/academy',
          '',
          'Une question avant de vous lancer ? Répondez simplement à ce message.',
          '',
          SIGNATURE,
        ].join('\n'),
      };
    case 'prospect_sans_compte':
      return {
        sujet: 'Votre compte WESTBOURSE',
        corps: [bonjour, '', 'Vous nous aviez laissé vos coordonnées sur WESTBOURSE.', 'Vous pouvez créer votre compte gratuitement sur https://www.westbourse.com/signup ; pour toute question, répondez à ce message.', '', SIGNATURE].join('\n'),
      };
    case 'actif_sans_abonnement':
      return {
        // Fonctions citées = celles que la table feature_flags réserve à Premium
        // (formations, screener, alertes, lecture_seance, dcf). Aucun prix ici :
        // il vit sur la page de souscription, il ne peut pas se périmer dans un e-mail.
        sujet: "L'Academy complète et vos outils Premium, pour un mois",
        corps: [
          bonjour,
          '',
          "Vous suivez déjà la BRVM avec WESTBOURSE. Avec Premium, vous passez de l'observation à l'analyse.",
          '',
          'Pendant un mois, Premium vous ouvre :',
          "• l'Academy WESTBOURSE en accès complet : cours, webinaires et conférences ;",
          '• le screener multi-critères : RSI, volume, score, secteur, dividende ;',
          '• vos alertes personnalisées, par e-mail ou sur WhatsApp ;',
          '• la lecture commentée de chaque séance ;',
          '• la valorisation DCF des sociétés cotées.',
          '',
          'Activez votre mois de Premium : https://www.westbourse.com/account/plan',
          '',
          // Règle commerciale réelle (migration 0156, 2026-10-19) : la formation
          // complète ouvre aussi un mois de Premium.
          'Vous préférez commencer par apprendre ? La formation complète de l’Academy vous donne un mois de Premium offert : https://www.westbourse.com/formations/academy',
          '',
          'Une question avant de vous lancer ? Répondez simplement à ce message.',
          '',
          SIGNATURE,
        ].join('\n'),
      };
  }
}

export function piedOpposition(lien: string): string {
  return `—\nVous ne souhaitez plus recevoir ce type de message ? ${lien}`;
}

export function versHtml(texte: string): string {
  const echappe = texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // Le lien s'arrête avant une entité (&quot; &lt; &gt;) ; la ponctuation finale reste du texte.
  return echappe
    .replace(/https:\/\/(?:(?!&(?:quot|lt|gt);)[^\s<])+/g, (url) => {
      const fin = /[.,;:!?)]+$/.exec(url)?.[0] ?? '';
      const href = fin ? url.slice(0, -fin.length) : url;
      return `<a href="${href}">${href}</a>${fin}`;
    })
    .replace(/\n/g, '<br>');
}
