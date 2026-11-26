import 'server-only';
import { signerPulse } from './pulseSignature';

export async function telechargerPulsePng(origine: string): Promise<Buffer | null> {
  const secret = process.env.OPS_PULSE_SECRET || process.env.RECAP_SECRET;
  if (!secret || secret.length < 32) return null;

  const { exp, sig } = await signerPulse(secret);
  try {
    const r = await fetch(
      `${origine.replace(/\/+$/, '')}/api/ops/pulse/image?exp=${exp}&sig=${sig}`,
      { cache: 'no-store', signal: AbortSignal.timeout(25_000) },
    );
    if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/')) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}
