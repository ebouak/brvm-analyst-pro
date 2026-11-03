import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Contrôle d'accès de « Qualité & Tests » : la vraie route des pièces jointes,
 * avec la vraie garde requireAdminApi ; seuls la session et la 2FA sont simulées.
 */

vi.mock('server-only', () => ({}));

const contexte = vi.fn();
const mfa = vi.fn();
vi.mock('@/lib/server/rbac', async (original) => ({
  ...(await original<typeof import('@/lib/server/rbac')>()),
  getAdminContext: () => contexte(),
}));
vi.mock('@/lib/server/mfa', () => ({ getMfaStatus: () => mfa() }));

const lire = vi.fn();
const signer = vi.fn(async () => 'https://stockage.test/signe?token=t');
vi.mock('@/lib/qa/depsSupabase', () => ({
  depsLectureSupabase: () => ({ lire, signerLecture: signer }),
}));

import { can, type AdminContext } from '@/lib/server/rbac';
import { ADMIN_NAV } from '@/lib/admin-nav';

const ID = '0b6c7c1e-2a8f-4c39-9d0e-6f1a2b3c4d5e';
const ctx = (roles: string[], permissions: string[], isSuperAdmin = false): AdminContext => ({
  userId: 'u', email: 'admin@test', roles, permissions: new Set(permissions), isSuperAdmin,
});

async function appeler() {
  const { GET } = await import('@/app/api/admin/qa/artefacts/[id]/route');
  return GET(new Request(`http://x.test/api/admin/qa/artefacts/${ID}`), { params: { id: ID } });
}

beforeEach(() => {
  contexte.mockReset();
  mfa.mockReset();
  lire.mockReset();
  signer.mockClear();
  lire.mockResolvedValue({ chemin: '42-1/a-0-0.png', type: 'capture', statut: 'televerse' });
});

describe('pièces jointes : accès', () => {
  it('visiteur ou compte non admin : 403, aucun fichier lu ni signé', async () => {
    contexte.mockResolvedValue(null);
    const r = await appeler();
    expect(r.status).toBe(403);
    expect(lire).not.toHaveBeenCalled();
    expect(signer).not.toHaveBeenCalled();
  });

  it('admin sans la permission qa.read (support) : 403', async () => {
    contexte.mockResolvedValue(ctx(['support_admin'], ['support.read', 'users.read']));
    mfa.mockResolvedValue({ isElevated: true, hasFactor: true });
    expect((await appeler()).status).toBe(403);
    expect(signer).not.toHaveBeenCalled();
  });

  it('admin avec qa.read mais sans 2FA présentée : 403', async () => {
    contexte.mockResolvedValue(ctx(['data_admin'], ['qa.read']));
    mfa.mockResolvedValue({ isElevated: false, hasFactor: true });
    expect((await appeler()).status).toBe(403);
    expect(signer).not.toHaveBeenCalled();
  });

  it('admin autorisé (qa.read + 2FA) : redirection vers une URL signée, sans cache', async () => {
    contexte.mockResolvedValue(ctx(['data_admin'], ['qa.read']));
    mfa.mockResolvedValue({ isElevated: true, hasFactor: true });
    const r = await appeler();
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('https://stockage.test/signe?token=t');
    expect(r.headers.get('cache-control')).toBe('no-store');
  });

  it('super admin : autorisé', async () => {
    contexte.mockResolvedValue(ctx(['super_admin'], [], true));
    mfa.mockResolvedValue({ isElevated: true, hasFactor: true });
    expect((await appeler()).status).toBe(302);
  });
});

describe('menu « Qualité & Tests »', () => {
  const entree = ADMIN_NAV.find((i) => i.href === '/admin/qualite')!;
  it('existe et exige qa.read', () => {
    expect(entree).toMatchObject({ label: 'Qualité & Tests', permission: 'qa.read' });
  });
  it('n’est visible que des comptes qui ont qa.read', () => {
    expect(can(ctx(['data_admin'], ['qa.read']), entree.permission!)).toBe(true);
    expect(can(ctx(['support_admin'], ['support.read']), entree.permission!)).toBe(false);
    expect(can(null, entree.permission!)).toBe(false);
  });
});
