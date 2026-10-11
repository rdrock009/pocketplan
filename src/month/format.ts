import type { ISODate, Paise } from '../finance'

const integerFormatter = new Intl.NumberFormat('en-IN')

/** Formatting also keeps the decimal conversion exact at the safe-integer boundary. */
export function money(value: Paise): string {
  return formatMinorUnits(BigInt(value))
}

function formatMinorUnits(value: bigint): string {
  const absolute = value < 0n ? -value : value
  const whole = integerFormatter.format(absolute / 100n)
  const fraction = (absolute % 100n).toString().padStart(2, '0')
  return `${value < 0n ? '−' : ''}₹${whole}.${fraction}`
}

export function moneyChange(current: Paise, proposed: Paise): string {
  const difference = BigInt(proposed) - BigInt(current)
  return `${difference > 0n ? '+' : ''}${formatMinorUnits(difference)}`
}

export function decimalMoney(value: Paise): string {
  const amount = BigInt(value)
  return `${amount / 100n}.${(amount % 100n).toString().padStart(2, '0')}`
}

export function dateLabel(date: ISODate): string {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}
