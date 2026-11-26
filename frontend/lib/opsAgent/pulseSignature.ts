/**
 * Lien signé HMAC-SHA256 pour l'image PNG Executive Card (/api/ops/pulse/image).
 * Web Crypto uniquement : la route d'image tourne en runtime Edge.
 */
export const PULSE_DUREE_MAX_S = 300;

const enc = new TextEncoder();

async function hmacHex(message: string, secret: string): Promise<string> {
  const cle = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', cle, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

function egaux(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function signerPulse(
  secret: string,
  maintenantS = Math.floor(Date.now() / 1000),
  dureeS = 180,
): Promise<{ exp: number; sig: string }> {
  const exp = maintenantS + Math.min(dureeS, PULSE_DUREE_MAX_S);
  return { exp, sig: await hmacHex(`pulse.${exp}`, secret) };
}

export async function verifierPulse(
  p: { exp: string | null; sig: string | null },
  secret: string | undefined,
  maintenantS = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!secret || secret.length < 32 || !p.exp || !p.sig) return false;
  const exp = Number(p.exp);
  if (!Number.isInteger(exp) || exp < maintenantS || exp > maintenantS + PULSE_DUREE_MAX_S) {
    return false;
  }
  if (!/^[0-9a-f]{64}$/.test(p.sig)) return false;
  return egaux(await hmacHex(`pulse.${exp}`, secret), p.sig);
}
