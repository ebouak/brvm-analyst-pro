import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { signatureResendValide, statutDepuisEvenement, peutPasser, lireEvenement, TOLERANCE_S } from './livraison';

// Secret au format Resend/Svix : « whsec_ » + clé en base64.
const CLE = Buffer.from('cle-de-test-pour-les-webhooks-resend');
const SECRET = 'whsec_' + CLE.toString('base64');
const MAINTENANT = 1_792_571_745;

function signer(id: string, ts: number, corps: string, cle = CLE): string {
  return 'v1,' + createHmac('sha256', cle).update(`${id}.${ts}.${corps}`).digest('base64');
}

describe('signature des webhooks Resend (protocole Svix)', () => {
  const corps = '{"type":"email.delivered","data":{"email_id":"abc"}}';
  const ent = (sig: string, ts = MAINTENANT, id = 'msg_1') => ({ id, timestamp: String(ts), signature: sig });

  it('accepte une signature correcte', () => {
    expect(signatureResendValide(corps, ent(signer('msg_1', MAINTENANT, corps)), SECRET, MAINTENANT)).toBe(true);
  });
  it('accepte si l’une des signatures de l’en-tête est correcte (rotation de secret)', () => {
    const sig = `v1,AAAA ${signer('msg_1', MAINTENANT, corps)}`;
    expect(signatureResendValide(corps, ent(sig), SECRET, MAINTENANT)).toBe(true);
  });
  it('refuse un corps modifié', () => {
    expect(signatureResendValide(corps + ' ', ent(signer('msg_1', MAINTENANT, corps)), SECRET, MAINTENANT)).toBe(false);
  });
  it('refuse une signature faite avec une autre clé', () => {
    const autre = signer('msg_1', MAINTENANT, corps, Buffer.from('autre-cle'));
    expect(signatureResendValide(corps, ent(autre), SECRET, MAINTENANT)).toBe(false);
  });
  it('refuse un horodatage hors de la fenêtre (rejeu)', () => {
    const vieux = MAINTENANT - TOLERANCE_S - 1;
    expect(signatureResendValide(corps, ent(signer('msg_1', vieux, corps), vieux), SECRET, MAINTENANT)).toBe(false);
  });
  it('refuse sans secret, sans en-tête ou avec un horodatage illisible', () => {
    const sig = signer('msg_1', MAINTENANT, corps);
    expect(signatureResendValide(corps, ent(sig), undefined, MAINTENANT)).toBe(false);
    expect(signatureResendValide(corps, { id: null, timestamp: String(MAINTENANT), signature: sig }, SECRET, MAINTENANT)).toBe(false);
    expect(signatureResendValide(corps, { id: 'msg_1', timestamp: 'abc', signature: sig }, SECRET, MAINTENANT)).toBe(false);
  });
});

describe('statut de livraison', () => {
  it('fait correspondre les événements Resend', () => {
    expect(statutDepuisEvenement('email.sent')).toBe('envoye');
    expect(statutDepuisEvenement('email.delivery_delayed')).toBe('retarde');
    expect(statutDepuisEvenement('email.delivered')).toBe('remis');
    expect(statutDepuisEvenement('email.bounced')).toBe('rejete');
    expect(statutDepuisEvenement('email.failed')).toBe('rejete');
    expect(statutDepuisEvenement('email.suppressed')).toBe('rejete');
    expect(statutDepuisEvenement('email.complained')).toBe('spam');
    // Ouvertures et clics : ignorés (aucun suivi de lecture).
    expect(statutDepuisEvenement('email.opened')).toBeNull();
    expect(statutDepuisEvenement('email.clicked')).toBeNull();
  });
  it('ne recule jamais : un événement en retard ou rejoué est sans effet', () => {
    expect(peutPasser(null, 'envoye')).toBe(true);
    expect(peutPasser('envoye', 'remis')).toBe(true);
    expect(peutPasser('remis', 'retarde')).toBe(false);
    expect(peutPasser('remis', 'remis')).toBe(false);
    expect(peutPasser('remis', 'spam')).toBe(true);
    expect(peutPasser('rejete', 'remis')).toBe(false);
  });
});

describe('lecture défensive de l’événement', () => {
  it('extrait le type, l’identifiant et la raison d’un rejet, bornée', () => {
    const e = lireEvenement({
      type: 'email.bounced',
      data: { email_id: 'e1', to: ['x@y.z'], bounce: { type: 'Permanent', subType: 'Suppressed', message: 'm'.repeat(500) } },
    });
    expect(e).not.toBeNull();
    expect(e!.emailId).toBe('e1');
    expect(e!.statut).toBe('rejete');
    expect(e!.detail!.length).toBeLessThanOrEqual(300);
    expect(e!.detail).toContain('Permanent');
  });
  it('renvoie null pour un événement sans intérêt ou mal formé', () => {
    expect(lireEvenement({ type: 'email.opened', data: { email_id: 'e1' } })).toBeNull();
    expect(lireEvenement({ type: 'email.delivered', data: {} })).toBeNull();
    expect(lireEvenement(null)).toBeNull();
    expect(lireEvenement('texte')).toBeNull();
  });
});
