import { describe, expect, it } from 'vitest';
import { champsRappel, estE164, hacherNumero } from './numero';
import { cleFenetre, estTypeAlerte } from './fenetre';
import { demandeStop, phraseDemandeStop } from './stop';
import {
  ANNONCE,
  CONSIGNES_RAPPEL,
  DUREE_MAX_RAPPEL,
  PREMIERE_PHRASE_RAPPEL,
  PREMIERE_PHRASE_TEST,
  nettoyerResume,
  parametresAlerte,
  parametresRappel,
  parametresTest,
} from './script';
import { eligibiliteRappel, lireDetailBland, plafondJour, type EtatRappel } from './statut';

// Numéros FICTIFS : plage réservée aux fictions (+33 6 39 98 xx xx, ARCEP) et
// suites de chiffres sans abonné. Aucun numéro réel dans ce fichier.
const FICTIF = '+33639980001';
const SECRET = 'x'.repeat(40);
const T0 = new Date('2026-11-19T10:00:00Z');

describe('numéro E.164', () => {
  it('accepte la forme E.164 et refuse le reste', () => {
    expect(estE164(FICTIF)).toBe(true);
    expect(estE164('0639980001')).toBe(false);
    expect(estE164('+0639980001')).toBe(false);
    expect(estE164('+331')).toBe(false);
    expect(estE164(null)).toBe(false);
  });
});

describe('empreinte du numéro', () => {
  it('est stable, hexadécimale, et dépend du secret', () => {
    const a = hacherNumero(FICTIF, SECRET);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hacherNumero(FICTIF, SECRET)).toBe(a);
    expect(hacherNumero(FICTIF, 'y'.repeat(40))).not.toBe(a);
    expect(a).not.toContain('639980001');
  });
  it('lève sans secret suffisant ou sur un numéro invalide', () => {
    expect(() => hacherNumero(FICTIF, undefined)).toThrow();
    expect(() => hacherNumero(FICTIF, 'court')).toThrow();
    expect(() => hacherNumero('0639980001', SECRET)).toThrow();
  });
});

describe('champs de rappel du formulaire', () => {
  it("n'enregistre AUCUN numéro sans case cochée", () => {
    expect(champsRappel({ telephone: FICTIF }, T0)).toEqual({ ok: true, telephone: null, consentAt: null });
    expect(champsRappel({ telephone: FICTIF, consent: 'true' }, T0)).toEqual({ ok: true, telephone: null, consentAt: null });
  });
  it('case cochée : numéro exigé, normalisé, consentement daté par le serveur', () => {
    expect(champsRappel({ telephone: '+33 6 39 98 00 01', consent: true }, T0)).toEqual({
      ok: true,
      telephone: FICTIF,
      consentAt: T0.toISOString(),
    });
    expect(champsRappel({ telephone: '', consent: true }, T0).ok).toBe(false);
    expect(champsRappel({ telephone: '06 39 98 00 01', consent: true }, T0).ok).toBe(false); // indicatif exigé
  });
});

describe('fenêtre de 6 h', () => {
  it('découpe la journée UTC en quatre fenêtres', () => {
    expect(cleFenetre('seance_absente', new Date('2026-11-19T00:00:00Z'))).toBe('seance_absente:2026-11-19T00');
    expect(cleFenetre('seance_absente', new Date('2026-11-19T05:59:59Z'))).toBe('seance_absente:2026-11-19T00');
    expect(cleFenetre('seance_absente', new Date('2026-11-19T06:00:00Z'))).toBe('seance_absente:2026-11-19T06');
    expect(cleFenetre('llm_panne_totale', new Date('2026-11-19T23:30:00Z'))).toBe('llm_panne_totale:2026-11-19T18');
  });
  it('liste fermée de types', () => {
    expect(estTypeAlerte('whatsapp_session')).toBe(true);
    expect(estTypeAlerte('autre')).toBe(false);
    expect(estTypeAlerte(undefined)).toBe(false);
  });
});

describe('détection STOP', () => {
  it.each([
    'Stop',
    'stop merci',
    "Ne m'appelez plus",
    'ne me rappelez plus jamais',
    'Je ne veux plus d’appel',
    'plus d appels svp',
    'Arrêtez de m’appeler',
    'pas la peine de me rappeler',
  ])('reconnaît « %s »', (t) => expect(phraseDemandeStop(t)).toBe(true));

  it.each(['Bonjour', "Comment créer un compte ?", 'Je voudrais parler à quelqu’un', 'Je ne comprends pas'])(
    "ne déclenche pas sur « %s »",
    (t) => expect(phraseDemandeStop(t)).toBe(false),
  );

  it("ignore les phrases de l'assistant", () => {
    expect(demandeStop([{ user: 'assistant', text: 'dites simplement stop' }, { user: 'user', text: 'Bonjour' }])).toBe(false);
    expect(demandeStop([{ user: 'assistant', text: 'Bonjour' }, { user: 'user', text: 'stop' }])).toBe(true);
    expect(demandeStop(null, 'assistant: dites stop\nuser: merci, au revoir')).toBe(false);
    expect(demandeStop([], 'assistant: bonjour\nuser: ne m’appelez plus')).toBe(true);
    expect(demandeStop(null, null)).toBe(false);
  });
});

describe('script du rappel', () => {
  const p = parametresRappel(null);
  it('annonce d’emblée un assistant automatisé', () => {
    expect(PREMIERE_PHRASE_RAPPEL.startsWith(ANNONCE)).toBe(true);
    expect(ANNONCE).toContain('assistant vocal automatisé de WESTBOURSE');
  });
  it('paramètres fixes : français, 3 min, sans enregistrement, sans transfert par défaut', () => {
    expect(p).toMatchObject({ language: 'fr', max_duration: DUREE_MAX_RAPPEL, record: false, wait_for_greeting: true });
    expect(p.max_duration).toBe(3);
    expect(p.transfer_phone_number).toBeUndefined();
    expect(parametresRappel(FICTIF).transfer_phone_number).toBe(FICTIF);
  });
  it('interdit conseil, chiffres de marché et données personnelles ; gère le STOP', () => {
    expect(CONSIGNES_RAPPEL).toMatch(/JAMAIS de conseil d'investissement/);
    expect(CONSIGNES_RAPPEL).toMatch(/aucun chiffre de marché/);
    expect(CONSIGNES_RAPPEL).toMatch(/AUCUNE donnée personnelle/);
    expect(CONSIGNES_RAPPEL).toMatch(/stop/);
    expect(CONSIGNES_RAPPEL).toMatch(/humain/);
  });
  it('ne contient aucun chiffre (contenu neutre)', () => {
    expect(PREMIERE_PHRASE_RAPPEL).not.toMatch(/\d/);
    expect(CONSIGNES_RAPPEL).not.toMatch(/\d/);
  });
});

describe('script d’alerte', () => {
  it('lit le type et un résumé nettoyé', () => {
    const p = parametresAlerte('seance_absente', 'Aucune cotation à 16 h. Voir https://exemple.org, joindre a@b.fr ou +33 6 39 98 00 01 🚨 sal_abcdef123');
    expect(p.first_sentence).toContain('Alerte critique');
    expect(p.first_sentence).not.toMatch(/https?:|@|639980|sal_|🚨/u);
    expect(p).toMatchObject({ record: false, language: 'fr' });
    expect(p.transfer_phone_number).toBeUndefined();
  });
  it('retire les identifiants de transaction', () => {
    expect(nettoyerResume('transaction 3f2a9c1e-0b4d-4e8a-9f1c-2d3e4f5a6b7c : accord refusé')).toBe('transaction : accord refusé');
  });
  it('borne la longueur du résumé', () => {
    expect(nettoyerResume('a '.repeat(400)).length).toBeLessThanOrEqual(240);
    expect(nettoyerResume(undefined)).toBe('');
  });
});

describe('lecture d’un appel Bland', () => {
  it('terminé avec transcription', () => {
    const l = lireDetailBland({ completed: true, call_length: 1.2, price: 0.11, call_ended_by: 'USER', concatenated_transcript: 'user: merci', transcripts: [{ user: 'user', text: 'merci' }] });
    expect(l).toMatchObject({ statut: 'termine', dureeMin: 1.2, prix: 0.11, transcriptionAbsente: false, stop: false });
  });
  it('terminé SANS transcription : signalé', () => {
    expect(lireDetailBland({ completed: true, call_length: 0.8 }).transcriptionAbsente).toBe(true);
  });
  it('non décroché, échec, en file, en cours', () => {
    expect(lireDetailBland({ completed: true, call_length: 0 }).statut).toBe('non_decroche');
    expect(lireDetailBland({ status: 'no-answer', completed: true }).statut).toBe('non_decroche');
    expect(lireDetailBland({ status: 'failed' }).statut).toBe('echec');
    expect(lireDetailBland({ status: 'queued' }).statut).toBe('en_file');
    expect(lireDetailBland({ status: 'in-progress' }).statut).toBe('en_cours');
  });
  it('STOP dans la transcription', () => {
    expect(lireDetailBland({ completed: true, call_length: 0.3, transcripts: [{ user: 'user', text: 'stop' }], concatenated_transcript: 'user: stop' }).stop).toBe(true);
  });
});

describe('éligibilité au rappel', () => {
  const base: EtatRappel = { telephone: FICTIF, consentAt: T0.toISOString(), opposition: false, dernier: null, appelsDuJour: 0, maxJour: 10 };
  const il = (ms: number) => new Date(T0.getTime() - ms).toISOString();
  it('ok avec numéro, consentement, sans opposition', () => expect(eligibiliteRappel(base, T0).ok).toBe(true));
  it('refuse sans consentement ou sans numéro', () => {
    expect(eligibiliteRappel({ ...base, consentAt: null }, T0).ok).toBe(false);
    expect(eligibiliteRappel({ ...base, telephone: null }, T0).ok).toBe(false);
  });
  it('refuse en opposition', () => expect(eligibiliteRappel({ ...base, opposition: true }, T0).ok).toBe(false));
  it('anti double-clic 2 min', () => {
    expect(eligibiliteRappel({ ...base, dernier: { statut: 'echec', cree_le: il(60_000) } }, T0).ok).toBe(false);
    expect(eligibiliteRappel({ ...base, dernier: { statut: 'echec', cree_le: il(121_000) } }, T0).ok).toBe(true);
  });
  it('refuse tant qu’un appel est en cours', () => {
    expect(eligibiliteRappel({ ...base, dernier: { statut: 'en_cours', cree_le: il(600_000) } }, T0).ok).toBe(false);
  });
  it('plafond du jour', () => {
    expect(eligibiliteRappel({ ...base, appelsDuJour: 10 }, T0).ok).toBe(false);
    expect(plafondJour(undefined)).toBe(10);
    expect(plafondJour('3')).toBe(3);
    expect(plafondJour('-1')).toBe(10);
    expect(plafondJour('abc')).toBe(10);
  });
});

describe('appel de test (console)', () => {
  const p = parametresTest();
  it('s’annonce comme automatisé ET comme un test, sans faux incident', () => {
    expect(PREMIERE_PHRASE_TEST.startsWith(ANNONCE)).toBe(true);
    expect(PREMIERE_PHRASE_TEST).toMatch(/appel de test/);
    expect(PREMIERE_PHRASE_TEST).not.toMatch(/alerte/i);
  });
  it('paramètres fixes : français, 1 min, sans enregistrement, sans transfert, sans chiffre', () => {
    expect(p).toMatchObject({ language: 'fr', max_duration: 1, record: false, wait_for_greeting: true });
    expect(p.transfer_phone_number).toBeUndefined();
    expect(PREMIERE_PHRASE_TEST).not.toMatch(/\d/);
    expect(p.task).not.toMatch(/\d/);
  });
});
