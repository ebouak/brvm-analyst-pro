import assert from 'node:assert';
import { buildPassport, doitPromouvoir } from './passport.ts';

// --- Cas réel ETIT 2025 : société publiant en USD, convertie au taux moyen ---
const pubEtit = {
  id: 'a1537a5b-9a59-4e64-a097-487f0919f651',
  libelle: 'Etats financiers IFRS - Exercice 2025 - ETI TG',
  date_publication: '2026-04-13',
  source_url: 'https://bfin.brvm.org/0/Communiques_emetteurs/20260413.pdf',
};
const provEtit = {
  code: 'ETIT', periode: '2025', table_cible: 'cash_flow_statements',
  publication_id: pubEtit.id, extrait_le: '2026-06-08T19:09:14.779Z',
  extracteur: 'deepseek-chat', confiance: 'extrait',
};

const etit = buildPassport(provEtit, pubEtit, { devise_origine: 'USD', taux_conversion: 581.834 });
assert.equal(etit.confiance, 'extrait');
assert.equal(etit.document.libelle, 'Etats financiers IFRS - Exercice 2025 - ETI TG');
assert.equal(etit.document.datePublication, '2026-04-13');
assert.ok(etit.document.url.startsWith('https://'));
assert.equal(etit.extracteur, 'deepseek-chat');
assert.deepEqual(etit.conversion, { devise: 'USD', taux: 581.834 });

// --- Exercice sans conversion : pas de mention de devise ---
const sansConv = buildPassport(provEtit, pubEtit, { devise_origine: null, taux_conversion: null });
assert.equal(sansConv.conversion, null, 'aucune conversion -> null, jamais un objet vide');
assert.equal(buildPassport(provEtit, pubEtit, null).conversion, null);

// --- Provenance absente : non_trace, jamais devinée ---
const inconnu = buildPassport(null, null, null);
assert.equal(inconnu.confiance, 'non_trace');
assert.equal(inconnu.document, null);
assert.equal(inconnu.extraitLe, null);
assert.equal(inconnu.extracteur, null);

// --- Publication orpheline (publication_id pointe dans le vide) ---
const orphelin = buildPassport({ ...provEtit, publication_id: 'inexistant' }, null, null);
assert.equal(orphelin.document, null, 'document null, pas d’exception');
assert.equal(orphelin.confiance, 'extrait', 'la confiance reste celle de la provenance');

// --- Publication sans URL : le libellé reste affichable ---
const sansUrl = buildPassport(provEtit, { ...pubEtit, source_url: null }, null);
assert.equal(sansUrl.document.url, null);
assert.equal(sansUrl.document.libelle, pubEtit.libelle);

// --- Publication sans libellé : rien d'affichable, document null ---
const sansLibelle = buildPassport(provEtit, { ...pubEtit, libelle: null }, null);
assert.equal(sansLibelle.document, null, 'un lien sans intitulé n’apprend rien : document null');

// --- Conversion conservée même sans provenance (elle vient d'une autre table) ---
const convSansProv = buildPassport(null, null, { devise_origine: 'USD', taux_conversion: 581.834 });
assert.equal(convSansProv.confiance, 'non_trace');
assert.deepEqual(convSansProv.conversion, { devise: 'USD', taux: 581.834 });

// --- Règle de promotion ---
assert.equal(doitPromouvoir('Sika Finance'), true);
assert.equal(doitPromouvoir('Madis Invest'), true);
assert.equal(
  doitPromouvoir(null), false,
  'une correction technique interne ne vérifie rien',
);
assert.equal(doitPromouvoir(undefined), false);
assert.equal(doitPromouvoir(''), false, 'chaîne vide = pas de source');
assert.equal(doitPromouvoir('   '), false, 'espaces seuls = pas de source');

console.log('✓ provenance/passport OK');
