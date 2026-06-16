export interface UploadFileMeta { name: string; type: string; size: number }

export interface UploadLimits {
  maxFiles: number;
  maxTotalBytes: number;
  allowed: string[];
  /** Taille max par fichier (octets), optionnel. */
  maxFileBytes?: number;
}

export interface ValidationResult { ok: boolean; message?: string }

const mb = (n: number) => Math.round(n / (1024 * 1024));

/** Valide une liste de fichiers (types + tailles). Pur, testable. */
export function validateUploads(files: UploadFileMeta[], limits: UploadLimits): ValidationResult {
  if (files.length === 0) return { ok: true };
  if (files.length > limits.maxFiles) {
    return { ok: false, message: `Trop de fichiers (max ${limits.maxFiles}).` };
  }
  let total = 0;
  for (const f of files) {
    if (!limits.allowed.includes(f.type)) {
      return { ok: false, message: `Type non autorisé : ${f.name} (${f.type || 'inconnu'}).` };
    }
    if (limits.maxFileBytes && f.size > limits.maxFileBytes) {
      return { ok: false, message: `${f.name} dépasse ${mb(limits.maxFileBytes)} Mo.` };
    }
    total += f.size;
  }
  if (total > limits.maxTotalBytes) {
    return { ok: false, message: `Taille totale dépasse ${mb(limits.maxTotalBytes)} Mo.` };
  }
  return { ok: true };
}
