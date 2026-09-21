import { describe, it, expect } from 'vitest';
import { dateSeanceDepuisHtml, MARKET_DATE_FIELDS } from '../src/scrapers/activitesMarche.js';

const page = (options: string) =>
  `<html><body><form><select name="${MARKET_DATE_FIELDS.dateSelect}" id="Main_DropDownList1">${options}</select><table></table></form></body></html>`;

describe('dateSeanceDepuisHtml — la date vient de la page, jamais de l’horloge', () => {
  it('lit l’option sélectionnée (YYYYMMDD → ISO)', () => {
    const html = page('<option value="20260921">21/09/2026</option><option selected="selected" value="20260918">18/09/2026</option><option value="20260917">17/09/2026</option>');
    expect(dateSeanceDepuisHtml(html)).toBe('2026-09-18');
  });
  it('accepte l’attribut nu `selected`', () => {
    expect(dateSeanceDepuisHtml(page('<option selected value="20260612">12/06/2026</option>'))).toBe('2026-06-12');
  });
  it('renonce sans sélection explicite : la première option n’est pas une preuve', () => {
    expect(dateSeanceDepuisHtml(page('<option value="20260921">21/09/2026</option><option value="20260918">18/09/2026</option>'))).toBeNull();
  });
  it('renonce sans déroulant ou avec une valeur mal formée', () => {
    expect(dateSeanceDepuisHtml('<html><body><table></table></body></html>')).toBeNull();
    expect(dateSeanceDepuisHtml(page('<option selected value="18/09/2026">18/09/2026</option>'))).toBeNull();
  });
});
