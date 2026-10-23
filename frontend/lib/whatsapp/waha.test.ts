import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  verifierSignatureWaha,
  lireEvenementWaha,
  estConversationPrivee,
  chatIdDepuisTelephone,
} from './waha';

const SECRET = 'cle-hmac-de-test';
const signer = (corps: string, secret = SECRET) => createHmac('sha512', secret).update(corps).digest('hex');

describe('signature des webhooks WAHA (HMAC-SHA512 du corps brut)', () => {
  const corps = '{"event":"message","payload":{"id":"m1"}}';
  it('accepte une signature correcte', () => {
    expect(verifierSignatureWaha(corps, signer(corps), SECRET)).toBe(true);
  });
  it('refuse un corps modifié, une autre clé, un en-tête absent ou un secret absent', () => {
    expect(verifierSignatureWaha(corps + ' ', signer(corps), SECRET)).toBe(false);
    expect(verifierSignatureWaha(corps, signer(corps, 'autre'), SECRET)).toBe(false);
    expect(verifierSignatureWaha(corps, null, SECRET)).toBe(false);
    expect(verifierSignatureWaha(corps, signer(corps), undefined)).toBe(false);
    expect(verifierSignatureWaha(corps, 'pas-hex', SECRET)).toBe(false);
  });
  it('tolère la casse de l’empreinte hexadécimale', () => {
    expect(verifierSignatureWaha(corps, signer(corps).toUpperCase(), SECRET)).toBe(true);
  });
});

describe('conversations prises en charge', () => {
  it('privées : numéro classique et identifiant anonyme (@lid)', () => {
    expect(estConversationPrivee('33612345678@c.us')).toBe(true);
    expect(estConversationPrivee('123456789012345@lid')).toBe(true);
    expect(estConversationPrivee('33612345678@s.whatsapp.net')).toBe(true);
  });
  it('ignorées : groupes, statuts, Chaînes, vide', () => {
    expect(estConversationPrivee('120363000000000000@g.us')).toBe(false);
    expect(estConversationPrivee('status@broadcast')).toBe(false);
    expect(estConversationPrivee('120363000000000000@newsletter')).toBe(false);
    expect(estConversationPrivee('')).toBe(false);
  });
  it('construit l’identifiant de conversation depuis un téléphone', () => {
    expect(chatIdDepuisTelephone('+33 7 43 65 72 71')).toBe('33743657271@c.us');
    expect(chatIdDepuisTelephone('0033743657271')).toBe('33743657271@c.us');
    expect(chatIdDepuisTelephone('abc')).toBeNull();
  });
});

describe('lecture défensive des événements', () => {
  it('message entrant', () => {
    const e = lireEvenementWaha({
      event: 'message',
      session: 'default',
      payload: { id: 'false_33612345678@c.us_ABC', from: '33612345678@c.us', fromMe: false, body: 'Bonjour', hasMedia: false, timestamp: 1792760000 },
    });
    expect(e).toEqual({
      type: 'message',
      id: 'false_33612345678@c.us_ABC',
      de: '33612345678@c.us',
      texte: 'Bonjour',
      deMoi: false,
      media: false,
      horodatage: 1792760000,
      prenom: null,
    });
  });
  it('prénom affiché (pushName), selon le moteur, borné et nettoyé', () => {
    const gows = lireEvenementWaha({ event: 'message', payload: { id: 'i', from: 'a@c.us', body: 'x', _data: { Info: { PushName: '  Awa\n ' } } } });
    expect(gows && gows.type === 'message' ? gows.prenom : 'x').toBe('Awa');
    const webjs = lireEvenementWaha({ event: 'message', payload: { id: 'i', from: 'a@c.us', body: 'x', _data: { notifyName: 'Konan' } } });
    expect(webjs && webjs.type === 'message' ? webjs.prenom : 'x').toBe('Konan');
    const long = lireEvenementWaha({ event: 'message', payload: { id: 'i', from: 'a@c.us', body: 'x', _data: { notifyName: 'N'.repeat(200) } } });
    expect(long && long.type === 'message' ? long.prenom?.length : 0).toBe(80);
  });
  it('accusés de remise : envoyé, remis, lu, erreur ; « en attente » ignoré', () => {
    const ack = (ack: number, ackName: string) => lireEvenementWaha({ event: 'message.ack', payload: { id: 'true_x@c.us_M1', ack, ackName } });
    expect(ack(1, 'SERVER')).toEqual({ type: 'message.ack', id: 'true_x@c.us_M1', livraison: 'envoye' });
    expect(ack(2, 'DEVICE')).toEqual({ type: 'message.ack', id: 'true_x@c.us_M1', livraison: 'remis' });
    expect(ack(3, 'READ')).toEqual({ type: 'message.ack', id: 'true_x@c.us_M1', livraison: 'remis' });
    expect(ack(-1, 'ERROR')).toEqual({ type: 'message.ack', id: 'true_x@c.us_M1', livraison: 'rejete' });
    expect(ack(0, 'PENDING')).toBeNull();
  });
  it('changement d’état de session', () => {
    expect(lireEvenementWaha({ event: 'session.status', session: 'default', payload: { status: 'FAILED' } })).toEqual({
      type: 'session.status',
      session: 'default',
      statut: 'FAILED',
    });
  });
  it('null pour un événement inconnu ou mal formé', () => {
    expect(lireEvenementWaha({ event: 'message.ack', payload: {} })).toBeNull();
    expect(lireEvenementWaha({ event: 'message', payload: { from: 'x@c.us' } })).toBeNull();
    expect(lireEvenementWaha(null)).toBeNull();
    expect(lireEvenementWaha('texte')).toBeNull();
  });
  it('borne la longueur du texte', () => {
    const e = lireEvenementWaha({ event: 'message', payload: { id: 'i', from: 'a@c.us', body: 'x'.repeat(10000) } });
    expect(e && e.type === 'message' ? e.texte.length : 0).toBe(4000);
  });
});
