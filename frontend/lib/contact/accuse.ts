/**
 * Accusé de réception du formulaire de contact.
 *
 * Il part vers une adresse que n'importe qui peut saisir. Il ne contient donc
 * AUCUNE donnée fournie par le visiteur — ni prénom, ni message, ni page : un
 * texte fixe. Le reprendre ferait du formulaire un relais pour envoyer, depuis
 * westbourse.com, un contenu arbitraire (un lien, une injure) à un tiers.
 * D'où une fonction sans paramètre : il n'existe aucun chemin pour y glisser
 * une saisie.
 *
 * Le délai annoncé est un engagement : le changer ici, nulle part ailleurs.
 */
export const DELAI_REPONSE = 'sous 2 jours ouvrés';

/** Un accusé par adresse et par fenêtre : une adresse ne peut pas être bombardée. */
export const ACCUSE_FENETRE_SECONDES = 24 * 60 * 60;

export function accuseReception(): { subject: string; html: string } {
  return {
    subject: 'WESTBOURSE — nous avons bien reçu votre message',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1a1a2e;line-height:1.55">
        <p>Bonjour,</p>
        <p>Nous avons bien reçu votre message envoyé depuis westbourse.com. Un membre de
        l'équipe vous répondra <strong>${DELAI_REPONSE}</strong>, à cette adresse.</p>
        <p>Inutile de renvoyer votre message entre-temps.</p>
        <p style="color:#5b6470;font-size:13px;margin-top:28px">
          Si vous n'êtes pas à l'origine de ce message, ignorez cet email : aucune autre
          suite ne lui sera donnée, et votre adresse n'est inscrite sur aucune liste.
        </p>
        <p style="color:#5b6470;font-size:13px">L'équipe WESTBOURSE</p>
      </div>
    `,
  };
}

/** Forme canonique d'une adresse, pour qu'une casse différente ne contourne pas la limite. */
export function normaliserEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Accusé de réception sur WhatsApp — texte FIXE, comme l'accusé email : rien de
 * la saisie n'y est repris. Envoyé en RÉPONSE à la personne qui vient d'écrire
 * (jamais à froid), au plus une fois par conversation et par 24 h.
 */
export function accuseReceptionWhatsapp(): string {
  return [
    '👋 Bonjour, merci pour votre message à *WESTBOURSE*.',
    '',
    `⏱️ Un membre de l'équipe vous répond *${DELAI_REPONSE}*, ici même sur WhatsApp. Inutile de renvoyer votre message.`,
    '',
    '📈 En attendant, suivez la séance et les sociétés cotées de la BRVM :',
    'https://www.westbourse.com',
    '',
    '💡 Tapez *AIDE* pour obtenir tout de suite un cours, des dividendes ou le palmarès du jour.',
  ].join('\n');
}
