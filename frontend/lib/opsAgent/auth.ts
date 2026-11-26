import { timingSafeEqual } from 'node:crypto';

export function verifierSecretOps(recu: string | null, attendu: string | undefined): boolean {
  if (!attendu || !recu) return false;
  const a = Buffer.from(recu, 'utf8');
  const b = Buffer.from(attendu, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Construit la liste blanche des `chat_id` autorisés à piloter l'agent Ops.
 * Fail-closed : un ensemble vide refuse tout le monde.
 */
export function parseAdminChatIds(
  envOps?: string,
  envFallback?: string,
  dbIds: number[] = [],
): Set<number> {
  const out = new Set<number>();
  const raw = envOps?.trim() ? envOps : envFallback;
  if (raw) {
    for (const part of raw.split(/[\s,;]+/)) {
      const s = part.trim();
      if (!s) continue;
      const n = Number(s);
      if (Number.isSafeInteger(n) && n > 0) out.add(n);
    }
  }
  for (const id of dbIds) {
    if (Number.isSafeInteger(id) && id > 0) out.add(id);
  }
  return out;
}

export function estAdminTelegram(chatId: number | undefined, allowed: Set<number>): boolean {
  if (!chatId || !Number.isSafeInteger(chatId) || chatId <= 0) return false;
  if (allowed.size === 0) return false;
  return allowed.has(chatId);
}

export type CommandParsed =
  | { type: 'start' }
  | { type: 'help' }
  | { type: 'tour' }
  | { type: 'cloture' }
  | { type: 'matin' }
  | { type: 'boc' }
  | { type: 'coherence' }
  | { type: 'relancer'; cible: string | null }
  | { type: 'paiements' }
  | { type: 'agregats' }
  | { type: 'contact' }
  | { type: 'crm' }
  | { type: 'llm' }
  | { type: 'ferie'; date: string | null; motif: string | null }
  | { type: 'kill'; flag: string | null }
  | { type: 'revive'; flag: string | null }
  | { type: 'pulse' }
  | { type: 'audit'; code: string | null }
  | { type: 'posts' }
  | { type: 'incidents' }
  | { type: 'libre'; texte: string };

export function parserCommandeOps(texte: string): CommandParsed {
  const brut = texte.trim();
  if (!brut.startsWith('/')) {
    return { type: 'libre', texte: brut };
  }

  const [cmdRaw, ...rest] = brut.split(/\s+/);
  const cmd = cmdRaw.split('@')[0].toLowerCase();
  const reste = rest.join(' ').trim();

  switch (cmd) {
    case '/start':
      return { type: 'start' };
    case '/help':
    case '/aide':
      return { type: 'help' };
    case '/tour':
      return { type: 'tour' };
    case '/cloture':
      return { type: 'cloture' };
    case '/matin':
      return { type: 'matin' };
    case '/boc':
      return { type: 'boc' };
    case '/coherence':
      return { type: 'coherence' };
    case '/relancer':
      return { type: 'relancer', cible: reste || null };
    case '/paiements':
      return { type: 'paiements' };
    case '/agregats':
      return { type: 'agregats' };
    case '/contact':
      return { type: 'contact' };
    case '/crm':
      return { type: 'crm' };
    case '/llm':
      return { type: 'llm' };
    case '/ferie': {
      const m = /^(\d{4}-\d{2}-\d{2})(?:\s+(.+))?$/.exec(reste);
      return { type: 'ferie', date: m ? m[1] : null, motif: m?.[2]?.trim() || null };
    }
    case '/kill':
      return { type: 'kill', flag: reste || null };
    case '/revive':
      return { type: 'revive', flag: reste || null };
    case '/pulse':
      return { type: 'pulse' };
    case '/audit':
      return { type: 'audit', code: reste || null };
    case '/posts':
      return { type: 'posts' };
    case '/incidents':
      return { type: 'incidents' };
    default:
      return { type: 'libre', texte: brut };
  }
}

export type CallbackParsed =
  | { kind: 'cmd'; nom: string }
  | { kind: 'cfm'; runId: string }
  | { kind: 'cnl'; runId: string }
  | { kind: 'wf'; alias: string }
  | { kind: 'inc_ack'; id: string }
  | { kind: 'inc_sil'; id: string }
  | { kind: 'inc_res'; id: string }
  | { kind: 'pay_ask'; id: string }
  | { kind: 'agr_ok'; id: string }
  | { kind: 'agr_ko'; id: string }
  | { kind: 'ctc_send'; id: string }
  | { kind: 'ctc_regen'; id: string }
  | { kind: 'post_ko'; target: string }
  | { kind: 'flg_ask'; action: 'kill' | 'revive'; code: string }
  | { kind: 'diag_ia'; cible: string }
  | { kind: 'unknown'; raw: string };

export function parserCallbackOps(data: string): CallbackParsed {
  const idx = data.indexOf(':');
  if (idx <= 0) return { kind: 'unknown', raw: data };
  const prefix = data.slice(0, idx);
  const val = data.slice(idx + 1).trim();
  if (!val) return { kind: 'unknown', raw: data };

  switch (prefix) {
    case 'cmd':
      return { kind: 'cmd', nom: val };
    case 'cfm':
      return { kind: 'cfm', runId: val };
    case 'cnl':
      return { kind: 'cnl', runId: val };
    case 'wf':
      return { kind: 'wf', alias: val };
    case 'inc_ack':
      return { kind: 'inc_ack', id: val };
    case 'inc_sil':
      return { kind: 'inc_sil', id: val };
    case 'inc_res':
      return { kind: 'inc_res', id: val };
    case 'pay_ask':
      return { kind: 'pay_ask', id: val };
    case 'agr_ok':
      return { kind: 'agr_ok', id: val };
    case 'agr_ko':
      return { kind: 'agr_ko', id: val };
    case 'ctc_send':
      return { kind: 'ctc_send', id: val };
    case 'ctc_regen':
      return { kind: 'ctc_regen', id: val };
    case 'post_ko':
      return { kind: 'post_ko', target: val };
    case 'flg_kill':
      return { kind: 'flg_ask', action: 'kill', code: val };
    case 'flg_rev':
      return { kind: 'flg_ask', action: 'revive', code: val };
    case 'diag':
      return { kind: 'diag_ia', cible: val };
    default:
      return { kind: 'unknown', raw: data };
  }
}
