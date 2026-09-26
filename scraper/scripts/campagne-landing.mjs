/**
 * Campagne d'annonce de la refonte — envoi UNIQUE aux comptes existants.
 *
 * ⚠️ INCIDENT DU 2026-09-24, ET LA RÈGLE QUI EN DÉCOULE. La première version
 * imprimait les adresses EN CLAIR en mode d'essai. Ce dépôt est PUBLIC, donc
 * ses journaux d'exécution GitHub le sont aussi : un simple essai a exposé une
 * centaine d'adresses d'utilisateurs à quiconque ouvrait la page des Actions.
 * Le journal a été supprimé dans la minute, mais la faute était dans le code.
 * RÈGLE : un script qui manipule des données personnelles ne doit jamais
 * pouvoir les écrire dans un journal — et surtout pas en mode d'essai, qui est
 * précisément celui qu'on lance sans y penser. Voir `masquer`.
 *
 * CE SCRIPT SUIT UNE RÈGLE ABSOLUE : ne jamais envoyer le même message deux
 * fois au même destinataire, jamais par accident. Trois garde-fous, dans cet
 * ordre d'importance :
 *
 *  1. MODE D'ESSAI PAR DÉFAUT. Sans `--envoyer`, rien n'est envoyé et rien
 *     n'est écrit en base — le script dit seulement ce qu'il ferait. C'est
 *     l'inverse de la convention habituelle du dépôt (où `--mock` est
 *     l'exception à demander) : ici, l'envoi de masse est l'exception, et
 *     elle doit être explicitement armée.
 *
 *  2. LA CLÉ NATURELLE (campagne, email) DE `campagne_envois` (migration
 *     0142_brief_email_et_campagne.sql) EST LA SEULE SOURCE DE VÉRITÉ. Avant
 *     d'envoyer quoi que ce soit, on lit TOUTES les lignes déjà journalisées
 *     pour cette campagne et on écarte ces adresses — sans exception, sans
 *     distinction de statut (`envoye` comme `echec`). Un envoi en échec
 *     n'est PAS retenté automatiquement à la prochaine exécution : un
 *     humain doit trancher (nouvelle valeur de `--campagne`, ou correction
 *     manuelle de la table), parce qu'un échec de journalisation pourrait en
 *     réalité masquer un envoi qui, lui, a réussi.
 *
 *  3. JOURNALISATION IMMÉDIATE, UN DESTINATAIRE À LA FOIS. La ligne
 *     `campagne_envois` est écrite juste après la tentative d'envoi, AVANT
 *     de passer au destinataire suivant — jamais accumulée pour être écrite
 *     à la fin. Si le script est interrompu (panne, timeout, Ctrl+C), ce qui
 *     a déjà été traité est déjà prouvé en base, et une relance ne retouche
 *     pas ces adresses. Si une écriture échoue, le script s'arrête
 *     immédiatement : continuer sans pouvoir journaliser créerait des envois
 *     non tracés — exactement ce que ce script existe pour empêcher.
 *
 * Contenu de l'email (sujet, texte, HTML) : `./campagne-landing.email.mjs`.
 * Ce fichier-ci ne fait qu'orchestrer la collecte des destinataires et
 * l'envoi ; il ne connaît pas le contenu du message.
 *
 * En-têtes Supabase : `entetesSupabase` (video/supabaseEntetes.mjs), réutilisé
 * tel quel — les clés `sb_secret_…` et les clés héritées exigent des en-têtes
 * incompatibles, voir ce fichier pour le détail.
 *
 * Usage :
 *   node scraper/scripts/campagne-landing.mjs
 *       Mode d'essai : liste ce qui serait fait, n'envoie rien.
 *   node scraper/scripts/campagne-landing.mjs --seulement=moi@exemple.com --envoyer
 *       Envoi réel à une seule adresse — pour se l'envoyer à soi-même d'abord.
 *   node scraper/scripts/campagne-landing.mjs --envoyer --limite=20
 *       Envoi réel plafonné aux 20 premiers destinataires éligibles.
 *
 * Options :
 *   --envoyer          arme l'envoi réel (absent => mode d'essai)
 *   --limite=N         plafonne le nombre de destinataires TRAITÉS
 *   --seulement=email  ignore tous les autres comptes, ne cible que celui-ci
 *   --campagne=id      identifiant de campagne (défaut : voir campagne-landing.email.mjs)
 *
 * Variables d'environnement — SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * RESEND_API_KEY, ALERTS_EMAIL_FROM. Lues dans l'environnement uniquement
 * (aucun repli sur un fichier local) : ce script est destiné au workflow
 * GitHub Actions, où les secrets arrivent déjà en variables d'environnement.
 * Seule leur PRÉSENCE est vérifiée ; leur valeur n'est jamais affichée ni
 * journalisée.
 */
import { entetesSupabase } from '../../video/supabaseEntetes.mjs';
import {
  CAMPAGNE as CAMPAGNE_PAR_DEFAUT,
  URL_PREFERENCES,
  sujet,
  html,
  texte,
} from './campagne-landing.email.mjs';

const dors = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Adresse MASQUÉE, pour tout ce qui sort sur la sortie standard.
 *
 * Garde les deux premiers caractères et le domaine : assez pour diagnostiquer
 * (faute de frappe, domaine en masse, adresse manifestement invalide), trop peu
 * pour identifier quelqu'un. Voir l'incident en tête de fichier.
 */
const masquer = (email) => {
  const s = typeof email === 'string' ? email : '';
  const at = s.lastIndexOf('@');
  if (at < 1) return '(adresse illisible)';
  return `${s.slice(0, Math.min(2, at))}…@${s.slice(at + 1)}`;
};

async function principal() {
  /* ────────────────────────────────────────── 1. arguments de commande ── */

  const argv = process.argv.slice(2);
  const ARME = argv.includes('--envoyer');

  const valeurOption = (nom) => {
    const prefixe = `--${nom}=`;
    const trouve = argv.find((a) => a.startsWith(prefixe));
    return trouve ? trouve.slice(prefixe.length) : null;
  };

  const OPTION_RECONNUE = (a) =>
    a === '--envoyer' || /^--(limite|seulement|campagne)=/.test(a);
  const inconnues = argv.filter((a) => a.startsWith('--') && !OPTION_RECONNUE(a));
  if (inconnues.length) {
    console.error(`Option(s) non reconnue(s) : ${inconnues.join(', ')}`);
    console.error('Options acceptées : --envoyer, --limite=N, --seulement=email, --campagne=id');
    process.exit(1);
  }

  const CAMPAGNE = valeurOption('campagne') || CAMPAGNE_PAR_DEFAUT;

  const limiteBrute = valeurOption('limite');
  let LIMITE = null;
  if (limiteBrute !== null) {
    const n = Number(limiteBrute);
    if (limiteBrute.trim() === '' || !Number.isInteger(n) || n < 0) {
      console.error(`--limite doit être un entier positif ou nul (reçu : "${limiteBrute}").`);
      process.exit(1);
    }
    LIMITE = n;
  }

  const SEULEMENT = valeurOption('seulement');
  if (SEULEMENT !== null && !SEULEMENT.includes('@')) {
    console.error(`--seulement ne ressemble pas à une adresse email : "${SEULEMENT}".`);
    process.exit(1);
  }

  console.log(
    ARME
      ? `=== Campagne « ${CAMPAGNE} » — ENVOI RÉEL ARMÉ (--envoyer) ===`
      : `=== Campagne « ${CAMPAGNE} » — MODE D'ESSAI : rien ne sera envoyé, rien ne sera écrit en base ===`,
  );

  /* ──────────────────────────────────────────────── 2. configuration ── */

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const RESEND_API_KEY = (process.env.RESEND_API_KEY || '').trim();
  const ALERTS_EMAIL_FROM = (process.env.ALERTS_EMAIL_FROM || '').trim();

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY absent(s).');
    if (ARME) {
      console.error("ÉCHEC — envoi réel demandé sans accès à Supabase configuré. Rien n'a été tenté.");
      process.exit(1);
    }
    console.log(
      "Mode d'essai : impossible de lister les destinataires réels tant que ces deux variables ne sont pas renseignées.",
    );
    console.log("=== FIN (mode d'essai) — aucune donnée disponible, aucun envoi. ===");
    process.exit(0);
  }

  if (ARME && (!RESEND_API_KEY || !ALERTS_EMAIL_FROM)) {
    console.error(
      "ÉCHEC — envoi réel demandé mais RESEND_API_KEY et/ou ALERTS_EMAIL_FROM absent(s). Rien n'a été tenté.",
    );
    process.exit(1);
  }
  if (!ARME && (!RESEND_API_KEY || !ALERTS_EMAIL_FROM)) {
    console.log(
      "RESEND_API_KEY et/ou ALERTS_EMAIL_FROM absent(s) — sans conséquence en mode d'essai, nécessaires seulement pour --envoyer.",
    );
  }

  const ENTETES_SB = { ...entetesSupabase(SUPABASE_KEY), 'User-Agent': 'westbourse-campagne/1.0' };

  /* ──────────────────────────────────────── 3. lecture paginée PostgREST ── */

  // PostgREST tronque à 1000 lignes PAR DÉFAUT, EN SILENCE. ~130 comptes
  // tiennent aujourd'hui sur une page, mais la base grossit : un plafond
  // silencieux ferait disparaître des destinataires sans qu'aucune erreur ne
  // le signale. Toujours paginer explicitement — leçon déjà payée ailleurs
  // dans ce dépôt (hebdo, range52).
  const TAILLE_PAGE = 1000;

  async function lireTout(cheminEtFiltre) {
    const lignes = [];
    let decalage = 0;
    const separateur = cheminEtFiltre.includes('?') ? '&' : '?';
    for (;;) {
      const url = `${SUPABASE_URL}/rest/v1/${cheminEtFiltre}${separateur}limit=${TAILLE_PAGE}&offset=${decalage}`;
      const r = await fetch(url, { headers: ENTETES_SB });
      if (!r.ok) {
        throw new Error(`lecture ${cheminEtFiltre} → HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
      }
      const page = await r.json();
      lignes.push(...page);
      if (page.length < TAILLE_PAGE) break;
      decalage += TAILLE_PAGE;
    }
    return lignes;
  }

  /* ───────────────────────────────────────── 4. destinataires éligibles ── */

  console.log('Lecture des comptes (profiles)…');
  const profils = await lireTout('profiles?select=id,email,display_name&order=id');
  console.log(`  ${profils.length} compte(s) au total.`);

  console.log(`Lecture du journal existant pour « ${CAMPAGNE} »…`);
  const dejaJournalises = new Set(
    (await lireTout(`campagne_envois?select=email&campagne=eq.${encodeURIComponent(CAMPAGNE)}`)).map((r) =>
      String(r.email).toLowerCase(),
    ),
  );
  console.log(
    `  ${dejaJournalises.size} adresse(s) déjà journalisée(s) pour cette campagne (ne seront pas retouchées).`,
  );

  // `--seulement` restreint le bassin à UN compte. S'il correspond à un
  // profil existant, on récupère son prénom réel ; sinon on construit un
  // destinataire minimal, pour permettre au propriétaire de se tester sur
  // une boîte qu'il possède mais qui n'est pas encore un compte WESTBOURSE.
  let bassin = profils;
  if (SEULEMENT !== null) {
    const correspondant = profils.find(
      (p) => typeof p.email === 'string' && p.email.trim().toLowerCase() === SEULEMENT.toLowerCase(),
    );
    bassin = [correspondant || { id: null, email: SEULEMENT, display_name: null }];
  }

  const trouves = bassin.length;
  let sauteAbsent = 0;
  let sauteInvalide = 0;
  let sauteDejaFait = 0;
  // Départ sur une copie : empêche aussi un doublon INTERNE au lot (deux
  // lignes `profiles` qui partageraient la même adresse email).
  const enCours = new Set(dejaJournalises);
  const eligibles = [];

  for (const p of bassin) {
    const email = typeof p.email === 'string' ? p.email.trim() : '';
    if (!email) {
      sauteAbsent++;
      continue;
    }
    if (!email.includes('@')) {
      sauteInvalide++;
      continue;
    }
    if (enCours.has(email.toLowerCase())) {
      sauteDejaFait++;
      continue;
    }
    enCours.add(email.toLowerCase());
    eligibles.push({ id: p.id ?? null, email, prenom: p.display_name ?? null });
  }

  const sautes = sauteAbsent + sauteInvalide + sauteDejaFait;
  const aTraiter = LIMITE !== null ? eligibles.slice(0, LIMITE) : eligibles;
  const restants = eligibles.length - aTraiter.length;

  console.log(
    `Éligibles : ${eligibles.length} sur ${trouves} examiné(s) — ${sautes} écarté(s) ` +
      `(${sauteAbsent} sans email, ${sauteInvalide} invalide(s), ${sauteDejaFait} déjà journalisé(s)).`,
  );
  if (restants > 0) {
    console.log(`--limite=${LIMITE} : ${aTraiter.length} traité(s) cette exécution, ${restants} resteront pour une prochaine.`);
  }
  console.log(`Sujet de l'email : ${sujet()}`);

  /* ─────────────────────────────────────────────────────────── 5. envoi ── */

  // Resend limite le débit ; un envoi en rafale se fait jeter. 650 ms
  // respecte la marge d'au moins 600 ms exigée.
  const DELAI_MIN_MS = 650;

  let envoyes = 0;
  let echecsEnvoi = 0;
  let tentatives = 0;
  let ecrituresReussies = 0;
  let arretPrecoce = null;

  for (const dest of aTraiter) {
    if (!ARME) {
      // Adresse MASQUÉE : ce journal est public (voir `masquer`).
      console.log(`  [ESSAI] serait envoyé à ${masquer(dest.email)}`);
      continue;
    }

    tentatives++;
    let statut = 'envoye';
    let raison = null;
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: ALERTS_EMAIL_FROM,
          to: dest.email,
          subject: sujet(),
          html: html({ prenom: dest.prenom }),
          text: texte({ prenom: dest.prenom }),
          // Ce que les fournisseurs de messagerie regardent pour ne pas
          // classer un envoi de masse en spam.
          headers: { 'List-Unsubscribe': `<${URL_PREFERENCES}>` },
        }),
      });
      if (!r.ok) {
        const detail = await r.text().catch(() => '');
        statut = 'echec';
        raison = `HTTP ${r.status}${detail ? ` — ${detail.slice(0, 300)}` : ''}`;
      }
    } catch (e) {
      statut = 'echec';
      raison = String(e?.message ?? e).slice(0, 300);
    }

    if (statut === 'envoye') {
      envoyes++;
      console.log(`  ${masquer(dest.email)} — envoyé`);
    } else {
      echecsEnvoi++;
      console.error(`  ${dest.email} — ÉCHEC ENVOI : ${raison}`);
    }

    // Journalisation IMMÉDIATE — avant de passer au destinataire suivant.
    // N'accumule rien : une ligne part vers la base ici, pas à la fin.
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/campagne_envois`, {
        method: 'POST',
        headers: { ...ENTETES_SB, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify([{ campagne: CAMPAGNE, email: dest.email, user_id: dest.id, statut, raison }]),
      });
      if (!r.ok) {
        const detail = await r.text().catch(() => '');
        throw new Error(`HTTP ${r.status}${detail ? ` — ${detail.slice(0, 300)}` : ''}`);
      }
      ecrituresReussies++;
    } catch (e) {
      arretPrecoce = `journalisation impossible pour ${dest.email} : ${e.message}`;
      console.error(`  ${dest.email} — IMPOSSIBLE DE JOURNALISER L'ENVOI : ${e.message}`);
      console.error(
        "  ARRÊT DE LA CAMPAGNE — continuer créerait des envois non tracés, donc rejouables en double au prochain lancement.",
      );
      break;
    }

    await dors(DELAI_MIN_MS);
  }

  /* ─────────────────────────────────────────────────────────── 6. bilan ── */

  console.log('');
  console.log(
    ARME
      ? `=== Campagne « ${CAMPAGNE} » — BILAN ===`
      : `=== Campagne « ${CAMPAGNE} » — BILAN (MODE D'ESSAI : rien n'a été envoyé, rien n'a été écrit en base) ===`,
  );
  console.log(`  trouvés : ${trouves}`);
  console.log(
    `  sautés  : ${sautes} (${sauteAbsent} sans email, ${sauteInvalide} invalide(s), ${sauteDejaFait} déjà journalisé(s))`,
  );
  if (restants > 0) console.log(`  restants (au-delà de --limite) : ${restants}`);
  console.log(`  envoyés : ${envoyes}`);
  console.log(`  échecs  : ${echecsEnvoi}`);
  if (!ARME) {
    console.log("MODE D'ESSAI — aucun email envoyé, aucune ligne écrite dans campagne_envois.");
  }

  if (ARME && arretPrecoce) {
    console.error('');
    console.error(`ÉCHEC — ${arretPrecoce}`);
    console.error(
      "Un envoi qu'on ne peut pas prouver est un envoi qu'on devra refaire à l'aveugle. Vérifier " +
        'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY et que la migration 0142_brief_email_et_campagne.sql ' +
        'est bien appliquée avant de relancer.',
    );
    process.exit(1);
  }

  // Filet de sécurité final, même si `arretPrecoce` ne s'est pas déclenché
  // (garde l'intention explicite lisible indépendamment du détail de la
  // boucle ci-dessus) : des envois ont eu lieu, mais rien n'a pu être prouvé.
  if (ARME && tentatives > 0 && ecrituresReussies === 0) {
    console.error('');
    console.error("ÉCHEC — des envois ont eu lieu mais aucune ligne n'a pu être écrite dans campagne_envois.");
    process.exit(1);
  }
}

principal().catch((e) => {
  console.error(`ERREUR INATTENDUE — ${e?.message ?? e}`);
  process.exit(1);
});
