// Parse decimal input exactly; never round a submitted financial amount.
export function rupeesToPaise(value: string): number {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value)) throw new Error("Use a positive amount with at most two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(paise) || paise <= 0 || paise > 100_000_000) throw new Error("Invalid payout amount.");
  return paise;
}
