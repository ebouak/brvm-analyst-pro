'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { saveOpsSettings } from '@/lib/admin/opsSettings';

export interface SaveSettingsInput {
  escaladeVocaleDelaiMin: number;
  briefMatinHeureUtc: string;
  modeMaintenanceNote: string;
  adminTelegramChatIdsRaw: string;
}

export async function saveAdminSettingsAction(
  input: SaveSettingsInput,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePermission('settings.write');
  if (!/^\d{2}:\d{2}$/.test(input.briefMatinHeureUtc.trim())) {
    return { ok: false, error: 'Heure du brief invalide (format HH:MM UTC attendu).' };
  }

  const chatIds = input.adminTelegramChatIdsRaw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s));

  if (chatIds.some((n) => !Number.isSafeInteger(n) || n <= 0)) {
    return { ok: false, error: 'Un ou plusieurs chat_id Telegram sont invalides (entiers positifs attendus).' };
  }

  try {
    const db = getServiceClient();
    const saved = await saveOpsSettings(
      db,
      {
        escaladeVocaleDelaiMin: Number(input.escaladeVocaleDelaiMin),
        briefMatinHeureUtc: input.briefMatinHeureUtc.trim(),
        modeMaintenanceNote: input.modeMaintenanceNote.trim(),
        adminTelegramChatIds: chatIds,
      },
      ctx.userId,
    );

    await recordAudit(ctx, {
      action: 'settings.ops.update',
      resourceType: 'ops_settings',
      severity: 'warning',
      metadata: {
        escaladeVocaleDelaiMin: saved.escaladeVocaleDelaiMin,
        briefMatinHeureUtc: saved.briefMatinHeureUtc,
        adminChatCount: saved.adminTelegramChatIds.length,
      },
    });

    revalidatePath('/admin/settings');
    revalidatePath('/admin/ops');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur serveur' };
  }
}
