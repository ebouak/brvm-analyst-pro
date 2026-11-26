import { describe, expect, it } from 'vitest';
import { appareilDe } from './appareil';
import { choisirFermetures, verifierGardeFou, type SessionVivante } from './plafond';
import { evaluerCompte, groupesInscriptions, mediane, type DonneesCompte } from './signaux';
import { composerRapport, type StatsRapport } from './rapport';

const UA = {
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-A146B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  gmailAndroid: 'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36 GSA/15.1',
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  edgeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
};

const MAINTENANT = new Date('2026-11-26T12:00:00Z');
const ilYa = (heures: number) => new Date(MAINTENANT.getTime() - heures * 3_600_000).toISOString();

function session(p: Partial<SessionVivante> & { sessionId: string }): SessionVivante {
  return {
    userId: 'u1',
    userAgent: UA.chromeWindows,
    reseau: '41.202.10.0/24',
    creeLe: ilYa(24 * 30),
    activite: ilYa(1),
    estPremium: true,
    exempte: false,
    ...p,
  };
}

describe('appareilDe', () => {
  it('reconnaît système et navigateur, Edge avant Chrome', () => {
    expect(appareilDe(UA.chromeAndroid).libelle).toBe('Chrome · Android');
    expect(appareilDe(UA.safariIphone).libelle).toBe('Safari · iPhone/iPad');
    expect(appareilDe(UA.edgeWindows).libelle).toBe('Edge · Windows');
    expect(appareilDe(UA.safariMac).libelle).toBe('Safari · Mac');
    expect(appareilDe(UA.firefoxLinux).libelle).toBe('Firefox · Linux');
    expect(appareilDe(UA.gmailAndroid).navigateur).toBe('Google');
  });
  it('ne lève pas sur une valeur vide', () => {
    expect(appareilDe(null).libelle).toBe('Appareil inconnu');
    expect(appareilDe('').libelle).toBe('Appareil inconnu');
  });
});

describe('choisirFermetures', () => {
  it('ne ferme rien à 3 appareils ou moins', () => {
    const s = [
      session({ sessionId: 'a', userAgent: UA.chromeAndroid, reseau: '1.1.1.0/24' }),
      session({ sessionId: 'b', userAgent: UA.safariIphone, reseau: '2.2.2.0/24' }),
      session({ sessionId: 'c', userAgent: UA.chromeWindows, reseau: '3.3.3.0/24' }),
    ];
    expect(choisirFermetures(s, { plafond: 3, maintenant: MAINTENANT })).toEqual([]);
  });

  it('ferme le créneau le moins récemment utilisé au 4e appareil', () => {
    const s = [
      session({ sessionId: 'a', userAgent: UA.chromeAndroid, reseau: '1.1.1.0/24', activite: ilYa(1) }),
      session({ sessionId: 'b', userAgent: UA.safariIphone, reseau: '2.2.2.0/24', activite: ilYa(2) }),
      session({ sessionId: 'c', userAgent: UA.chromeWindows, reseau: '3.3.3.0/24', activite: ilYa(50) }),
      session({ sessionId: 'd', userAgent: UA.safariMac, reseau: '4.4.4.0/24', activite: ilYa(3) }),
    ];
    const f = choisirFermetures(s, { plafond: 3, maintenant: MAINTENANT });
    expect(f.map((x) => x.session.sessionId)).toEqual(['c']);
    expect(f[0].recente).toBe(true);
  });

  it("ne déconnecte pas un abonné seul : Chrome et Gmail sur le même téléphone et le même réseau comptent pour un", () => {
    const s = [
      session({ sessionId: 'a', userAgent: UA.chromeAndroid, reseau: '1.1.1.0/24' }),
      session({ sessionId: 'a2', userAgent: UA.gmailAndroid, reseau: '1.1.1.0/24' }),
      session({ sessionId: 'b', userAgent: UA.safariIphone, reseau: '2.2.2.0/24' }),
      session({ sessionId: 'c', userAgent: UA.chromeWindows, reseau: '3.3.3.0/24' }),
    ];
    expect(choisirFermetures(s, { plafond: 3, maintenant: MAINTENANT })).toEqual([]);
  });

  it('ne ferme JAMAIS la session qui vient de se connecter, même si elle est la plus ancienne en apparence', () => {
    const s = [
      session({ sessionId: 'a', userAgent: UA.chromeAndroid, reseau: '1.1.1.0/24', activite: ilYa(1) }),
      session({ sessionId: 'b', userAgent: UA.safariIphone, reseau: '2.2.2.0/24', activite: ilYa(1) }),
      session({ sessionId: 'c', userAgent: UA.chromeWindows, reseau: '3.3.3.0/24', activite: ilYa(1) }),
      session({ sessionId: 'nouvelle', userAgent: UA.safariMac, reseau: '4.4.4.0/24', creeLe: ilYa(500), activite: ilYa(500) }),
    ];
    const f = choisirFermetures(s, { plafond: 3, garder: 'nouvelle', maintenant: MAINTENANT });
    expect(f.map((x) => x.session.sessionId)).not.toContain('nouvelle');
    expect(f).toHaveLength(1);
  });

  it('ignore les comptes non Premium et exemptés', () => {
    const quatre = (userId: string, p: Partial<SessionVivante>) =>
      ['1', '2', '3', '4'].map((n) => session({ sessionId: `${userId}${n}`, userId, reseau: `${n}.0.0.0/24`, ...p }));
    const s = [...quatre('gratuit', { estPremium: false }), ...quatre('admin', { exempte: true })];
    expect(choisirFermetures(s, { plafond: 3, maintenant: MAINTENANT })).toEqual([]);
  });

  it('ferme en entier un créneau de trop, et marque non récente une session dormante', () => {
    const s = [
      session({ sessionId: 'a', userAgent: UA.chromeAndroid, reseau: '1.1.1.0/24', activite: ilYa(1) }),
      session({ sessionId: 'b', userAgent: UA.safariIphone, reseau: '2.2.2.0/24', activite: ilYa(1) }),
      session({ sessionId: 'c', userAgent: UA.chromeWindows, reseau: '3.3.3.0/24', activite: ilYa(1) }),
      session({ sessionId: 'v1', userAgent: UA.firefoxLinux, reseau: '9.9.9.0/24', creeLe: ilYa(24 * 60), activite: ilYa(24 * 40) }),
      session({ sessionId: 'v2', userAgent: UA.firefoxLinux, reseau: '9.9.9.0/24', creeLe: ilYa(24 * 70), activite: ilYa(24 * 45) }),
    ];
    const f = choisirFermetures(s, { plafond: 3, maintenant: MAINTENANT });
    expect(f.map((x) => x.session.sessionId).sort()).toEqual(['v1', 'v2']);
    expect(f.every((x) => !x.recente)).toBe(true);
  });

  it('traite chaque compte séparément', () => {
    const s = [
      ...['1', '2', '3', '4'].map((n) => session({ sessionId: `x${n}`, userId: 'x', reseau: `${n}.0.0.0/24`, activite: ilYa(Number(n)) })),
      ...['1', '2'].map((n) => session({ sessionId: `y${n}`, userId: 'y', reseau: `${n}.0.0.0/24` })),
    ];
    const f = choisirFermetures(s, { plafond: 3, maintenant: MAINTENANT });
    expect(f.map((x) => x.session.sessionId)).toEqual(['x4']);
  });
});

describe('verifierGardeFou', () => {
  const fermeture = (n: number, recente: boolean) =>
    Array.from({ length: n }, (_, i) => ({ session: session({ sessionId: `s${i}` }), creneau: `c${i}`, recente }));
  it('accepte un premier passage de quelques dizaines de sessions dormantes', () => {
    expect(verifierGardeFou(fermeture(13, false))).toEqual({ ok: true });
  });
  it('refuse au-delà de 40 sessions ou de 10 sessions récentes', () => {
    expect(verifierGardeFou(fermeture(41, false)).ok).toBe(false);
    expect(verifierGardeFou(fermeture(11, true)).ok).toBe(false);
  });
});

function compte(p: Partial<DonneesCompte> = {}): DonneesCompte {
  return {
    userId: 'u1', estPremium: true, exempte: false, sessions: [], fermeturesPlafond: [], connexions: [],
    usageIa30j: 0, tailleGroupe: 0, legitimeJusquau: null, ...p,
  };
}
const ctx = { maintenant: MAINTENANT, medianeUsageIa: 8 };

describe('evaluerCompte', () => {
  it('un usage ordinaire est normal', () => {
    const e = evaluerCompte(compte({
      sessions: [{ userAgent: UA.chromeAndroid, derniereVue: ilYa(1) }, { userAgent: UA.chromeWindows, derniereVue: ilYa(2) }],
      connexions: [{ createdAt: ilYa(48), pays: 'CI' }, { createdAt: ilYa(2), pays: 'CI' }],
      usageIa30j: 10,
    }), ctx);
    expect(e.niveau).toBe('normal');
    expect(e.raisons).toEqual([]);
  });

  it('sièges disputés : 2 → à surveiller, 4 → suspect ; les sessions dormantes ne comptent pas', () => {
    const f = (n: number, dormante = false) => Array.from({ length: n }, (_, i) => ({
      createdAt: ilYa(i + 1), derniereActivite: ilYa(dormante ? 24 * 40 : i + 2),
    }));
    expect(evaluerCompte(compte({ fermeturesPlafond: f(2) }), ctx).niveau).toBe('surveiller');
    expect(evaluerCompte(compte({ fermeturesPlafond: f(4) }), ctx).niveau).toBe('suspect');
    expect(evaluerCompte(compte({ fermeturesPlafond: f(5, true) }), ctx).niveau).toBe('normal');
  });

  it('chaque raison porte son chiffre et son seuil', () => {
    const e = evaluerCompte(compte({ connexions: [{ createdAt: ilYa(5), pays: 'CI' }, { createdAt: ilYa(3), pays: 'FR' }] }), ctx);
    expect(e.raisons).toEqual([expect.objectContaining({ code: 'pays_rapproches', valeur: 1, seuil: 1, niveau: 'surveiller' })]);
  });

  it('trois raisons à surveiller cumulées font un compte suspect', () => {
    const e = evaluerCompte(compte({
      connexions: [
        { createdAt: ilYa(10), pays: 'CI' }, { createdAt: ilYa(8), pays: 'SN' }, { createdAt: ilYa(100), pays: 'FR' },
      ],
      usageIa30j: 60,
    }), ctx);
    expect(e.raisons.map((r) => r.code).sort()).toEqual(['pays_multiples', 'pays_rapproches', 'usage_ia']);
    expect(e.niveau).toBe('suspect');
  });

  it('un compte marqué légitime reste normal mais garde ses raisons', () => {
    const e = evaluerCompte(compte({ tailleGroupe: 6, legitimeJusquau: ilYa(-24) }), ctx);
    expect(e.niveau).toBe('normal');
    expect(e.legitime).toBe(true);
    expect(e.raisons).toHaveLength(1);
  });

  it("un compte d'administration ou de test n'est jamais évalué", () => {
    expect(evaluerCompte(compte({ exempte: true, tailleGroupe: 9 }), ctx)).toEqual({ userId: 'u1', niveau: 'normal', raisons: [], legitime: false });
  });
});

describe('groupesInscriptions', () => {
  const c = (userId: string, p: { jours?: number; ua?: string; reseau?: string; exempte?: boolean } = {}) => ({
    userId,
    creeLe: ilYa(24 * (p.jours ?? 1)),
    exempte: p.exempte ?? false,
    premiere: { userAgent: p.ua ?? UA.chromeAndroid, reseau: p.reseau ?? '5.5.5.0/24' },
  });
  it('trois comptes récents, même réseau et même navigateur exact, forment un groupe', () => {
    const g = groupesInscriptions([c('a'), c('b'), c('d'), c('e', { ua: UA.safariIphone })], MAINTENANT);
    expect([...g.entries()].sort()).toEqual([['a', 3], ['b', 3], ['d', 3]]);
  });
  it('écarte les comptes anciens et les comptes de test', () => {
    const g = groupesInscriptions([c('a'), c('b', { jours: 40 }), c('d', { exempte: true })], MAINTENANT);
    expect(g.size).toBe(0);
  });
});

describe('mediane', () => {
  it('ignore les zéros', () => {
    expect(mediane([0, 0, 4, 10, 6])).toBe(6);
    expect(mediane([2, 4])).toBe(3);
    expect(mediane([0])).toBe(0);
  });
});

describe('composerRapport', () => {
  const base: StatsRapport = {
    jour: '2026-11-26', mode: 'actif', plafond: 3,
    fermetures24h: { sessions: 0, comptes: 0, recentes: 0, emailsEnvoyes: 0, emailsEchecs: 0, simulees: 0 },
    suspects: 0, nouveauxSuspects: 0, aSurveiller: 0, groupes: { nombre: 0, comptes: 0 }, suspensionsActives: 0,
    lien: 'https://www.westbourse.com/admin/securite',
  };
  it('un jour calme se dit, et le lien est toujours là', () => {
    const t = composerRapport(base);
    expect(t).toContain('26/11/2026');
    expect(t).toContain('Fermetures en 24 h : aucune.');
    expect(t).toContain('Comptes à examiner : aucun.');
    expect(t).toContain('https://www.westbourse.com/admin/securite');
  });
  it('signale un échec d’e-mail et les nouveaux suspects', () => {
    const t = composerRapport({
      ...base,
      fermetures24h: { sessions: 2, comptes: 1, recentes: 1, emailsEnvoyes: 0, emailsEchecs: 1, simulees: 0 },
      suspects: 2, nouveauxSuspects: 1, aSurveiller: 3, groupes: { nombre: 1, comptes: 4 },
    });
    expect(t).toContain('2 sessions sur 1 compte, dont 1 encore utilisée');
    expect(t).toContain('1 NON CONFIRMÉ');
    expect(t).toContain('Comptes suspects : 2 (dont 1 nouveau) · à surveiller : 3.');
    expect(t).toContain('1 groupe, 4 comptes');
  });
  it('dit quand le plafond est coupé ou simulé', () => {
    expect(composerRapport({ ...base, mode: 'off' })).toContain('COUPÉ');
    expect(composerRapport({ ...base, mode: 'simulation' })).toContain('SIMULATION');
  });
  it('ne contient aucune adresse e-mail', () => {
    expect(composerRapport(base)).not.toMatch(/@/);
  });
});

describe('suspensionActive', () => {
  const d = (type: 'suspension' | 'levee' | 'legitime', heures: number, jusquau: string | null = null) => ({
    type, created_at: ilYa(heures), jusqu_au: jusquau,
  });
  it("aucune décision, ou une levée plus récente : pas de suspension", async () => {
    const { suspensionActive } = await import('./decisions');
    expect(suspensionActive([], MAINTENANT)).toBeNull();
    expect(suspensionActive([d('suspension', 10), d('levee', 2)], MAINTENANT)).toBeNull();
  });
  it('une suspension sans date court jusqu’à la levée ; une suspension échue ne vaut plus', async () => {
    const { suspensionActive } = await import('./decisions');
    expect(suspensionActive([d('suspension', 2)], MAINTENANT)).toBe('indefinie');
    expect(suspensionActive([d('suspension', 2, ilYa(-48))], MAINTENANT)).toBe(ilYa(-48));
    expect(suspensionActive([d('suspension', 100, ilYa(1))], MAINTENANT)).toBeNull();
    expect(suspensionActive([d('legitime', 1), d('suspension', 2)], MAINTENANT)).toBe('indefinie');
  });
});

describe('e-mails de sécurité', () => {
  it('fermeture : nomme l’appareil, la date et le lien vers la page Sécurité', async () => {
    const { emailFermeture } = await import('./emails');
    const m = emailFermeture({ plafond: 3, appareils: [{ libelle: 'Chrome · Windows', derniereActivite: '2026-11-24T08:00:00Z' }], siteUrl: 'https://www.westbourse.com' });
    expect(m.sujet).toBe('Un appareil a été déconnecté de votre compte WESTBOURSE');
    expect(m.texte).toContain('3 appareils à la fois');
    expect(m.texte).toContain('- Chrome · Windows, utilisé pour la dernière fois le 24/11/2026');
    expect(m.texte).toContain('https://www.westbourse.com/account/security');
  });
  it('avertissement et suspension : aucun motif libre, une voie de contestation', async () => {
    const { emailAvertissement, emailSuspension } = await import('./emails');
    expect(emailAvertissement({ siteUrl: 'https://x' }).texte).toContain('répondez simplement à ce message');
    const s = emailSuspension({ jusquau: '2026-12-26T00:00:00Z', siteUrl: 'https://x' });
    expect(s.texte).toContain("jusqu'au 26/12/2026");
    expect(s.texte).toContain('nous réexaminerons la décision');
    expect(emailSuspension({ jusquau: null, siteUrl: 'https://x' }).texte).toContain("jusqu'à nouvel examen");
  });
});
