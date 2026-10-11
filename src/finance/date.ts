declare const dateBrand: unique symbol
export type ISODate = string & { readonly [dateBrand]: true }
const DAY_MS = 86_400_000

/** Calendar dates only; UTC arithmetic makes results independent of local timezone/DST. */
export function isoDate(value: string): ISODate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError('Use a YYYY-MM-DD calendar date.')
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new RangeError('Invalid calendar date.')
  }
  return value as ISODate
}

export function addDays(date: ISODate, days: number): ISODate {
  if (!Number.isSafeInteger(days)) throw new RangeError('Day offset must be an integer.')
  const timestamp = Date.parse(`${isoDate(date)}T00:00:00.000Z`) + days * DAY_MS
  const result = new Date(timestamp)
  if (!Number.isFinite(result.getTime())) throw new RangeError('Date is out of range.')
  return isoDate(result.toISOString().slice(0, 10))
}

export function daysBetween(first: ISODate, last: ISODate): number {
  return (Date.parse(`${isoDate(last)}T00:00:00Z`) - Date.parse(`${isoDate(first)}T00:00:00Z`)) / DAY_MS
}

/** Anchor to the original day, so Jan 31 -> Feb 28 -> Mar 31 (no drift). */
export function addMonthsClamped(date: ISODate, months: number): ISODate {
  const source = new Date(`${isoDate(date)}T00:00:00Z`)
  const target = new Date(source)
  target.setUTCDate(1)
  target.setUTCMonth(source.getUTCMonth() + months)
  const lastDay = new Date(target)
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0)
  target.setUTCDate(Math.min(source.getUTCDate(), lastDay.getUTCDate()))
  return isoDate(target.toISOString().slice(0, 10))
}
