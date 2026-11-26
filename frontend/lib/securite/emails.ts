/**
 * E-mails de sécurité des comptes — PURS (texte, sans envoi).
 *
 * Trois messages, tous transactionnels : fermeture par le plafond (l'abonné
 * doit savoir pourquoi un appareil lui demande un nouveau code), avertissement
 * et suspension (décisions humaines, prises depuis la console).
 *
 * Aucun texte libre de l'administrateur n'est recopié : le motif saisi dans la
 * console reste interne. Une faute de frappe ou une donnée personnelle glissée
 * dans un motif ne doit jamais partir chez l'utilisateur.
 */

export interface EmailTexte {
  sujet: string;
  texte: string;
}

function date(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

export function emailFermeture(p: {
  plafond: number;
  appareils: { libelle: string; derniereActivite: string | null }[];
  siteUrl: string;
}): EmailTexte {
  const lignes = p.appareils.map((a) => {
    const d = date(a.derniereActivite);
    return `- ${a.libelle}${d ? `, utilisé pour la dernière fois le ${d}` : ''}`;
  });
  const une = p.appareils.length === 1;
  return {
    sujet: une ? 'Un appareil a été déconnecté de votre compte WESTBOURSE' : 'Des appareils ont été déconnectés de votre compte WESTBOURSE',
    texte: [
      'Bonjour,',
      '',
      `Votre abonnement Premium permet de rester connecté sur ${p.plafond} appareils à la fois. Votre compte en utilisait davantage : nous avons fermé ${une ? 'la session la moins récemment utilisée' : 'les sessions les moins récemment utilisées'}.`,
      '',
      ...lignes,
      '',
      `Si c'était vous, il n'y a rien à faire : sur cet appareil, il suffira de vous reconnecter avec un code reçu par e-mail.`,
      '',
      `Si vous ne reconnaissez pas une connexion, ouvrez la page Sécurité de votre compte : vous y voyez vos appareils connectés et pouvez déconnecter ceux que vous ne reconnaissez pas.`,
      `${p.siteUrl}/account/security`,
      '',
      "L'équipe WESTBOURSE",
    ].join('\n'),
  };
}

export function emailAvertissement(p: { siteUrl: string }): EmailTexte {
  return {
    sujet: 'Utilisation de votre compte WESTBOURSE',
    texte: [
      'Bonjour,',
      '',
      'Ces dernières semaines, votre compte WESTBOURSE a été utilisé depuis de nombreux appareils ou lieux différents. Un compte est personnel : il ne doit pas être partagé.',
      '',
      'Si vous ne reconnaissez pas certaines connexions, ouvrez la page Sécurité de votre compte et déconnectez les appareils inconnus :',
      `${p.siteUrl}/account/security`,
      '',
      "Si cet usage est bien le vôtre (plusieurs appareils, déplacements), répondez simplement à ce message pour nous l'indiquer.",
      '',
      "L'équipe WESTBOURSE",
    ].join('\n'),
  };
}

export function emailSuspension(p: { jusquau: string | null; siteUrl: string }): EmailTexte {
  const d = date(p.jusquau);
  return {
    sujet: 'Votre accès Premium WESTBOURSE est suspendu',
    texte: [
      'Bonjour,',
      '',
      `Après examen de l'utilisation de votre compte, nous avons suspendu votre accès Premium ${d ? `jusqu'au ${d}` : "jusqu'à nouvel examen"}, en raison d'un usage qui ne correspond pas à un compte personnel.`,
      '',
      'Votre compte reste ouvert, avec les fonctionnalités gratuites.',
      '',
      "Si vous pensez qu'il s'agit d'une erreur, répondez à ce message : nous réexaminerons la décision.",
      '',
      "L'équipe WESTBOURSE",
    ].join('\n'),
  };
}
