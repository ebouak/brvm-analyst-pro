/**
 * Libellés du calendrier officiel BRVM → codes, par table CURÉE.
 *
 * Aucun repli flou : un libellé inconnu reste non rapproché et le run le nomme
 * (leçon du 2026-09-08 — le flou avait attribué à TTLC les dividendes de TOTAL
 * SENEGAL). Les 35 codes ont été vérifiés contre brvm_instruments le 2026-10-20.
 * Nouvelle valeur au calendrier : ajouter sa clé ici (voir cleNom).
 */

/** Clé compacte : sans accents, majuscules, lettres et chiffres seulement. */
export function cleNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export const CODES_CALENDRIER: Readonly<Record<string, string>> = {
  BOABURKINAFASO: 'BOABF',
  BOACOTEDIVOIRE: 'BOAC',
  SONATELSENEGAL: 'SNTS',
  BOABENIN: 'BOAB',
  ECOBANKCI: 'ECOC',
  BOASENEGAL: 'BOAS',
  SICABLECI: 'CABC',
  BOAMALI: 'BOAM',
  ORANGECI: 'ORAC',
  ONATELBF: 'ONTBF',
  CORISBANKINTBF: 'CBIBF',
  PALMCI: 'PALC',
  ECOBANKTRANSNATIONALINCORPORATEDTG: 'ETIT',
  BICICI: 'BICC',
  TOTALENERGIESMARKETINGSN: 'TTLS',
  CIECI: 'CIEC',
  SOLIBRACI: 'SLBC',
  SOCIETEIVOIRIENNEDEBANQUE: 'SIBC',
  BIICBN: 'BICB',
  LOTERIENATIONALEDUBENIN: 'LNBB',
  NSIABANQUECI: 'NSBC',
  SOGBCI: 'SOGC',
  SITABCI: 'STBC',
  CFAOMOTORSCI: 'CFAC',
  SOCIETEGENERALECI: 'SGBC',
  SAPHCI: 'SPHC',
  TOTALENERGIESMARKETINGCI: 'TTLC',
  NESTLECI: 'NTLC',
  NEICEDACI: 'NEIC',
  SODECI: 'SDCC',
  SMBCI: 'SMBC',
  VIVOENERGYCI: 'SHEC',
  SERVAIRABIDJANCI: 'ABJC',
  TRACTAFRICMOTORSCI: 'PRSC',
  AFRICAGLOBALLOGISTICSCI: 'SDSC',
};

export function codeDuNom(nom: string): string | null {
  return CODES_CALENDRIER[cleNom(nom)] ?? null;
}
