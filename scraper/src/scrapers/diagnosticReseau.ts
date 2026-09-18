/**
 * Diagnostic d'une erreur réseau — fonction PURE, testée.
 *
 * POURQUOI. Le job AFX échoue à chaque exécution en CI depuis sa création
 * (136/136) sur un simple « fetch failed », alors que le même code réussit en
 * local. Ce message ne dit RIEN : undici range la vraie raison dans
 * `err.cause` — ECONNRESET, ETIMEDOUT, UND_ERR_CONNECT_TIMEOUT, ENOTFOUND,
 * erreur de certificat… — et, quand l'hôte a plusieurs adresses, dans
 * `err.cause.errors`, une par adresse tentée. Sans ces codes on ne peut pas
 * distinguer un blocage des IP de datacenter, un DNS, un TLS ou un timeout.
 *
 * AUCUN SECRET ne transite ici : on ne lit que le nom, le code, le message et
 * l'adresse visée par l'erreur. Les messages sont tronqués.
 */

export interface DiagnosticReseau {
  /** Nom de l'erreur de premier niveau (TypeError, TimeoutError…). */
  nom: string;
  /** Code de la cause profonde (ECONNRESET, ETIMEDOUT…), ou null. */
  code: string | null;
  /** Codes par adresse tentée, quand la cause est agrégée (plusieurs IP). */
  tentatives: string[];
  /** Résumé lisible, sûr à journaliser. */
  resume: string;
}

const tronquer = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n)}…` : s);

interface CauseLike {
  code?: unknown;
  message?: unknown;
  address?: unknown;
  port?: unknown;
  errors?: unknown;
}

function commeCause(v: unknown): CauseLike | null {
  return v && typeof v === 'object' ? (v as CauseLike) : null;
}

export function decrireErreurReseau(err: unknown): DiagnosticReseau {
  if (!(err instanceof Error)) {
    return { nom: 'NonError', code: null, tentatives: [], resume: tronquer(String(err)) };
  }
  const cause = commeCause((err as Error & { cause?: unknown }).cause);
  const code = cause && typeof cause.code === 'string' ? cause.code : null;

  const tentatives: string[] = [];
  if (cause && Array.isArray(cause.errors)) {
    for (const e of cause.errors) {
      const c = commeCause(e);
      if (!c) continue;
      const cible = typeof c.address === 'string' ? `${c.address}${typeof c.port === 'number' ? `:${c.port}` : ''}` : '?';
      tentatives.push(`${cible} ${typeof c.code === 'string' ? c.code : 'sans-code'}`);
    }
  }

  const causeMsg = cause && typeof cause.message === 'string' ? cause.message : '';
  const resume = [
    `${err.name}: ${tronquer(err.message)}`,
    code ? `cause=${code}` : null,
    causeMsg ? `(${tronquer(causeMsg)})` : null,
    tentatives.length ? `tentatives=[${tentatives.join(', ')}]` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return { nom: err.name, code, tentatives, resume };
}
