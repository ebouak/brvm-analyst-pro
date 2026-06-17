import assert from 'node:assert/strict';
import { validateLead, computeLeadKpis, whatsappLink, isLeadStatut } from './leads.ts';

// validateLead — rejette sans consentement
let r = validateLead({ nom: 'Awa Diop', email: 'awa@example.com', consent: false });
assert.equal(r.ok, false, 'sans consentement → refus');

// validateLead — rejette email invalide
r = validateLead({ nom: 'Awa Diop', email: 'pasunemail', consent: true });
assert.equal(r.ok, false, 'email invalide → refus');

// validateLead — rejette nom trop court
r = validateLead({ nom: 'A', email: 'awa@example.com', consent: true });
assert.equal(r.ok, false, 'nom trop court → refus');

// validateLead — accepte un lead complet + normalise email/niveau
r = validateLead({
  nom: '  Awa Diop ', email: 'AWA@Example.COM ', telephone: '+225 07 00 00 00',
  pays: 'Côte d’Ivoire', message: 'Je débute', niveau: 'debutant', consent: 'on',
});
assert.equal(r.ok, true, 'lead complet → ok');
assert.equal(r.value.email, 'awa@example.com', 'email minusculisé + trimé');
assert.equal(r.value.nom, 'Awa Diop', 'nom trimé');
assert.equal(r.value.niveau, 'debutant', 'niveau conservé');
assert.equal(r.value.consent, true, 'consent normalisé à true');

// validateLead — niveau inconnu → null
r = validateLead({ nom: 'Awa Diop', email: 'awa@example.com', niveau: 'expert', consent: true });
assert.equal(r.ok, true);
assert.equal(r.value.niveau, null, 'niveau inconnu → null');

// computeLeadKpis
const k = computeLeadKpis([
  { statut: 'nouveau' }, { statut: 'nouveau' }, { statut: 'contacte' },
  { statut: 'converti' }, { statut: 'perdu' }, { statut: null },
]);
assert.equal(k.total, 6, 'total compte toutes les lignes');
assert.equal(k.nouveau, 2);
assert.equal(k.contacte, 1);
assert.equal(k.converti, 1);
assert.equal(k.perdu, 1);

// whatsappLink
assert.equal(whatsappLink(null, 'Awa'), null, 'sans numéro → null');
assert.equal(whatsappLink('123', 'Awa'), null, 'numéro trop court → null');
const link = whatsappLink('+225 07 00 00 00 11', 'Awa');
assert.ok(link && link.startsWith('https://wa.me/2250700000011'), 'lien wa.me nettoyé');
assert.ok(link.includes('text='), 'message pré-rempli');

// isLeadStatut
assert.equal(isLeadStatut('converti'), true);
assert.equal(isLeadStatut('autre'), false);

console.log('✓ leads.ts — tous les tests passent');
