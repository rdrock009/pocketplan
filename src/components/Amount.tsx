import { memo } from 'react'
import type { Paise } from '../finance'
import { money } from '../month/format'

interface Props {
  value: Paise
  id?: string
}

/**
 * Formatted currency display with conditional negative styling.
 * Memoized to avoid re-renders when parent state changes but amount stays the same.
 */
export const Amount = memo(function Amount({ value, id }: Props) {
  return (
    <span data-testid={id} className={`amount${value < 0 ? ' negative' : ''}`}>
      {money(value)}
    </span>
  )
})
