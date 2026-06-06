/**
 * Parse une réponse fetch en JSON de façon robuste. Si le corps n'est pas du
 * JSON (ex. Vercel renvoie "Request Entity Too Large" en texte brut pour un
 * payload trop gros, ou une page d'erreur HTML), on renvoie un objet d'erreur
 * exploitable plutôt que de laisser `res.json()` lever « Unexpected token ».
 */
export interface JsonResult {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
}

export async function readJsonResponse(res: Response): Promise<JsonResult> {
  const raw = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(raw) as Record<string, unknown> };
  } catch {
    // Corps non-JSON : on en fait un message d'erreur lisible.
    const snippet = raw.trim().slice(0, 200) || `HTTP ${res.status}`;
    const friendly =
      res.status === 413
        ? 'Fichier trop volumineux pour l’analyse (limite serveur). PDF scanné trop lourd.'
        : snippet;
    return { ok: false, status: res.status, data: { error: friendly } };
  }
}
