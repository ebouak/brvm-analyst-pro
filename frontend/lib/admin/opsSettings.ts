import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface OpsSettings {
  escaladeVocaleDelaiMin: number;
  briefMatinHeureUtc: string;
  modeMaintenanceNote: string;
  adminTelegramChatIds: number[];
}

export const DEFAULT_OPS_SETTINGS: OpsSettings = {
  escaladeVocaleDelaiMin: 5,
  briefMatinHeureUtc: '07:30',
  modeMaintenanceNote: '',
  adminTelegramChatIds: [],
};

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function parseChatIdArray(val: unknown): number[] {
  if (!Array.isArray(val)) return [];
  const out: number[] = [];
  for (const item of val) {
    const n = typeof item === 'number' ? item : Number(item);
    if (Number.isSafeInteger(n) && n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

export async function loadOpsSettings(db: SupabaseClient): Promise<OpsSettings> {
  try {
    const { data, error } = await db.from('ops_settings').select('cle, valeur');
    if (error || !data) return { ...DEFAULT_OPS_SETTINGS };

    const map = new Map<string, unknown>();
    for (const row of data as Array<{ cle: string; valeur: unknown }>) {
      map.set(row.cle, row.valeur);
    }

    const heureRaw = map.get('brief_matin_heure_utc');
    const heure =
      typeof heureRaw === 'string' && /^\d{2}:\d{2}$/.test(heureRaw)
        ? heureRaw
        : DEFAULT_OPS_SETTINGS.briefMatinHeureUtc;

    const noteRaw = map.get('mode_maintenance_note');
    const note = typeof noteRaw === 'string' ? noteRaw : DEFAULT_OPS_SETTINGS.modeMaintenanceNote;

    return {
      escaladeVocaleDelaiMin: clampInt(
        map.get('escalade_vocale_delai_min'),
        0,
        30,
        DEFAULT_OPS_SETTINGS.escaladeVocaleDelaiMin,
      ),
      briefMatinHeureUtc: heure,
      modeMaintenanceNote: note,
      adminTelegramChatIds: parseChatIdArray(map.get('admin_telegram_chat_ids')),
    };
  } catch {
    return { ...DEFAULT_OPS_SETTINGS };
  }
}

export async function saveOpsSettings(
  db: SupabaseClient,
  patch: Partial<OpsSettings>,
  actorUserId: string,
): Promise<OpsSettings> {
  const current = await loadOpsSettings(db);
  const next: OpsSettings = {
    escaladeVocaleDelaiMin:
      patch.escaladeVocaleDelaiMin !== undefined
        ? clampInt(patch.escaladeVocaleDelaiMin, 0, 30, current.escaladeVocaleDelaiMin)
        : current.escaladeVocaleDelaiMin,
    briefMatinHeureUtc:
      patch.briefMatinHeureUtc !== undefined && /^\d{2}:\d{2}$/.test(patch.briefMatinHeureUtc)
        ? patch.briefMatinHeureUtc
        : current.briefMatinHeureUtc,
    modeMaintenanceNote:
      patch.modeMaintenanceNote !== undefined
        ? patch.modeMaintenanceNote.slice(0, 500)
        : current.modeMaintenanceNote,
    adminTelegramChatIds:
      patch.adminTelegramChatIds !== undefined
        ? parseChatIdArray(patch.adminTelegramChatIds)
        : current.adminTelegramChatIds,
  };

  const now = new Date().toISOString();
  const rows = [
    {
      cle: 'escalade_vocale_delai_min',
      valeur: next.escaladeVocaleDelaiMin,
      updated_at: now,
      updated_by: actorUserId,
    },
    {
      cle: 'brief_matin_heure_utc',
      valeur: next.briefMatinHeureUtc,
      updated_at: now,
      updated_by: actorUserId,
    },
    {
      cle: 'mode_maintenance_note',
      valeur: next.modeMaintenanceNote,
      updated_at: now,
      updated_by: actorUserId,
    },
    {
      cle: 'admin_telegram_chat_ids',
      valeur: next.adminTelegramChatIds,
      updated_at: now,
      updated_by: actorUserId,
    },
  ];

  const { error } = await db.from('ops_settings').upsert(rows, { onConflict: 'cle' });
  if (error) {
    throw new Error(`Enregistrement ops_settings impossible : ${error.message}`);
  }
  return next;
}
