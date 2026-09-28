import { describe, it, expect } from 'vitest';
import { jsonLdScript } from './jsonLd';

describe('jsonLdScript', () => {
  it('échappe </script> via \\u003c', () => {
    const out = jsonLdScript({ html: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('</script>');
    expect(out).toContain('\\u003c/script>');
  });

  it('échappe U+2028 et U+2029 en \u2028/\u2029', () => {
    const LS = String.fromCharCode(0x2028);
    const PS = String.fromCharCode(0x2029);
    const out = jsonLdScript({ t: `a${LS}b${PS}c` });
    expect(out).not.toContain(LS);
    expect(out).not.toContain(PS);
    expect(out).toContain('\\u2028');
    expect(out).toContain('\\u2029');
  });

  it('reste du JSON parsable', () => {
    const obj = { a: 'x<y', b: String.fromCharCode(0x2028) };
    const out = jsonLdScript(obj);
    // \\u003c et \\u2028 restent échappés en JSON, donc parsable
    expect(JSON.parse(out)).toBeDefined();
  });
});
