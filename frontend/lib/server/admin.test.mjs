import assert from 'node:assert';
import { isAdminEmail } from './admin-emails.ts';

assert.equal(isAdminEmail('ebouak@gmail.com'), true);
assert.equal(isAdminEmail('EBOUAK@Gmail.com'), true);   // casse ignorée
assert.equal(isAdminEmail('autre@gmail.com'), false);
assert.equal(isAdminEmail(null), false);
assert.equal(isAdminEmail(undefined), false);

console.log('✓ admin tests OK');
