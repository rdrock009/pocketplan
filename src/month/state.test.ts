import { describe, expect, it } from 'vitest'
import { calculateFinancials, isoDate, rupees } from '../finance'
import { money } from './format'
import { initialMonthState, monthReducer, transactionDate } from './state'

describe('shared month state edge cases', () => {
  it('rejects a stale repeated payment instead of creating a second cash debit', () => {
    const state = initialMonthState()
    const obligation = calculateFinancials(state.plan, state.asOf).obligations[0]
    if (!obligation) throw new Error('Sample bill missing')
    const action = { type: 'pay' as const, obligation, date: transactionDate(state), id: 'payment-1' }
    const paid = monthReducer(state, action)
    const repeated = monthReducer(paid, { ...action, id: 'payment-2' })
    expect(repeated.error).toContain('already paid')
    expect(repeated.plan).toBe(paid.plan)
    expect(paid.plan.expenses.filter(item => item.obligation)).toHaveLength(1)
  })
  it('stops future renewals without deleting an overdue unpaid renewal', () => {
    const initial = initialMonthState()
    const later = monthReducer(initial, { type: 'snapshot', date: isoDate('2026-10-16') })
    const cancelled = monthReducer(later, { type: 'cancel-subscription', id: 'sample-music' })
    expect(cancelled.error).toBeNull()
    const result = calculateFinancials(cancelled.plan, cancelled.asOf)
    expect(result.obligations.find(item => item.reference.kind === 'subscription')?.remaining).toBe(rupees('199'))
    expect(cancelled.plan.subscriptions[0]?.endsOn).toBe('2026-10-16')
  })
  it('preserves a prepaid future renewal when cancellation is requested', () => {
    const initial = initialMonthState()
    const subscriptionBill = calculateFinancials(initial.plan, initial.asOf).obligations.find(item => item.reference.kind === 'subscription')
    if (!subscriptionBill) throw new Error('Sample subscription missing')
    const paid = monthReducer(initial, { type: 'pay', id: 'prepaid', obligation: subscriptionBill, date: transactionDate(initial) })
    const cancelled = monthReducer(paid, { type: 'cancel-subscription', id: 'sample-music' })
    expect(cancelled.error).toBeNull()
    expect(cancelled.plan.subscriptions[0]?.endsOn).toBe('2026-10-15')
    expect(calculateFinancials(cancelled.plan, cancelled.asOf).cashBalance).toBe(rupees('9751'))
  })
  it('rejects posted dates beyond the horizon without advancing the snapshot', () => {
    const initial = initialMonthState()
    const rejected = monthReducer(initial, { type: 'add-expense', item: { id: 'late', label: 'Late', amount: rupees('100'), date: isoDate('2026-11-01') } })
    expect(rejected.error).toContain('within your 30-day month')
    expect(rejected.plan).toBe(initial.plan)
    expect(rejected.asOf).toBe(initial.asOf)
  })
  it('rejects removing a deposit that would leave a later withdrawal unfunded', () => {
    const initial = initialMonthState()
    const withdrawal = monthReducer(initial, { type: 'transfer', item: { id: 'withdrawal', goalId: 'sample-buffer', amount: rupees('100'), direction: 'withdrawal', date: initial.asOf } })
    const rejected = monthReducer(withdrawal, { type: 'remove', collection: 'savingsTransfers', id: 'sample-save' })
    expect(rejected.error).toContain('withdrawals exceed')
    expect(rejected.plan).toBe(withdrawal.plan)
  })
  it('formats exact paise, including negative amounts and large safe integers', () => {
    expect(money(rupees('0.01'))).toBe('₹0.01')
    expect(money(rupees('-1234.56'))).toBe('−₹1,234.56')
    expect(money(rupees('90071992547409.91'))).toBe('₹9,00,71,99,25,47,409.91')
  })
})
