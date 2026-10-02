export function parseMoney(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const text = String(value ?? "")
    .trim()
    .replace(/R\$\s*/g, "")
    .replace(/\s/g, "");
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  return normalized && /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

export function calculateInstallments(sale: number, entry: number, count: number) {
  if (
    ![sale, entry, count].every(Number.isFinite) ||
    sale <= 0 ||
    entry < 0 ||
    entry > sale ||
    !Number.isInteger(count) ||
    count < 0 ||
    count > 120
  ) {
    throw new Error("Informe venda, entrada e quantidade de parcelas válidas.");
  }
  const cents = Math.round(sale * 100) - Math.round(entry * 100);
  if (count === 0 && cents !== 0)
    throw new Error("O saldo precisa ser parcelado ou pago na entrada.");
  const base = count ? Math.floor(cents / count) : 0;
  const remainder = cents - base * count;
  const amounts = Array.from({ length: count }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100);
  return { amounts, regular: base / 100, last: amounts.at(-1) || 0, balance: cents / 100 };
}

export function monthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Mês inválido.");
  const [year, number] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${days}` };
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
