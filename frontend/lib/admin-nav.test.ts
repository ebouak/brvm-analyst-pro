import { describe, it, expect } from 'vitest';
import { ADMIN_NAV, ADMIN_NAV_GROUPS, adminBreadcrumb } from './admin-nav';

describe('admin-nav', () => {
  it('contient 6 groupes non vides sans doublons de href', () => {
    expect(ADMIN_NAV_GROUPS).toHaveLength(6);
    const hrefs = ADMIN_NAV.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('référence les pages autrefois orphelines et les nouvelles pages Ops', () => {
    const hrefs = new Set(ADMIN_NAV.map((i) => i.href));
    expect(hrefs.has('/admin/coherence')).toBe(true);
    expect(hrefs.has('/admin/ops')).toBe(true);
    expect(hrefs.has('/admin/calendrier')).toBe(true);
    expect(hrefs.has('/admin/reseaux/tiktok')).toBe(true);
    expect(hrefs.has('/admin/formations/modules')).toBe(true);
    expect(hrefs.has('/admin/settings')).toBe(true);
  });

  it('calcule le breadcrumb correctement pour les routes exactes et imbriquées', () => {
    expect(adminBreadcrumb('/admin')).toBe("Vue d'ensemble");
    expect(adminBreadcrumb('/admin/ops')).toBe('Bot Ops & Canaux');
    expect(adminBreadcrumb('/admin/controle/boc')).toBe('Écarts BOC');
    expect(adminBreadcrumb('/admin/users/1234')).toBe('Utilisateurs');
  });
});
