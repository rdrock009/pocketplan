declare const paiseBrand: unique symbol

/** Signed integer minor units. Positive transaction amounts are validated by the engine. */
export type Paise = number & { readonly [paiseBrand]: true }

export function paise(value: number): Paise {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError('Money must be a safe integer number of paise.')
  }
  return value as Paise
}

/** Parse decimal text without floating-point multiplication or rounding. */
export function rupees(value: string): Paise {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) throw new RangeError('Use a decimal rupee amount with at most two decimal places.')
  const magnitude = BigInt(match[2] ?? '0') * 100n + BigInt((match[3] ?? '').padEnd(2, '0'))
  return fromBigInt(match[1] === '-' ? -magnitude : magnitude)
}

export function fromBigInt(value: bigint): Paise {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError('Money calculation exceeds the safe integer range.')
  }
  return paise(Number(value))
}

export function sumPaise(values: readonly number[]): Paise {
  return fromBigInt(values.reduce((sum, value) => sum + BigInt(paise(value)), 0n))
}

export function negatePaise(value: Paise): Paise {
  return fromBigInt(-BigInt(paise(value)))
}
