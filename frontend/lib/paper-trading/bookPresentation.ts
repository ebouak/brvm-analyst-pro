export function formatBookDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return 'Date indisponible';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(parsed);
}

export function formatSpread(book: {
  buyPrice: number | null;
  sellPrice: number | null;
}): { amount: number; percent: number } | null {
  const { buyPrice, sellPrice } = book;
  if (
    buyPrice == null ||
    sellPrice == null ||
    !Number.isFinite(buyPrice) ||
    !Number.isFinite(sellPrice) ||
    buyPrice <= 0 ||
    sellPrice < buyPrice
  ) {
    return null;
  }

  const amount = sellPrice - buyPrice;
  return { amount, percent: (amount / buyPrice) * 100 };
}
