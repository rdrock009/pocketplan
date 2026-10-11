import { describe, expect, it } from 'vitest'
import { calculateFinancials, isoDate, paise, rupees } from '../finance'
import { moneyChange } from '../month/format'
import { initialWorkspaceState, workspaceReducer } from './state'
import type { WorkspaceState } from './state'
import type { Scenario } from './scenario'

const date = isoDate('2026-10-07')
const cost = (id = 'decision', kind: 'purchase' | 'emergency' = 'purchase', amount = '500'): Extract<Scenario, { kind: 'purchase' | 'emergency' }> => ({ id, kind, label: 'Headphones', amount: rupees(amount), date })
const preview = (scenario: Scenario, state = initialWorkspaceState()) => workspaceReducer(state, { type: 'preview', scenario })
const apply = (state: WorkspaceState, id = 'decision') => workspaceReducer(state, { type: 'apply', scenarioId: id })
const snapshot = (state: WorkspaceState) => calculateFinancials(state.month.plan, state.month.asOf)
const proposed = (state: WorkspaceState) => { if (!state.preview) throw new Error(state.error ?? 'Missing preview'); return calculateFinancials(state.preview.proposed.plan, state.preview.proposed.asOf) }

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child) }
  return value
}

describe('isolated What If previews', () => {
  it('previews and discards without mutating even deeply frozen committed inputs', () => {
    const current = deepFreeze(initialWorkspaceState())
    const draft = preview(cost(), current)
    expect(draft.month).toBe(current.month)
    expect(proposed(draft).cashBalance).toBe(rupees('9450'))
    expect(proposed(draft).forecast.closingCash).toBe(rupees('3301'))
    expect(snapshot(draft)).toEqual(snapshot(current))
    const discarded = workspaceReducer(draft, { type: 'discard' })
    expect(discarded.month).toBe(current.month)
    expect(discarded.preview).toBeNull()
    expect(discarded.undoStack).toHaveLength(0)
  })
  it('charges an emergency once and explains its shortfall', () => {
    const result = proposed(preview(cost('emergency', 'emergency', '12000')))
    expect(result.cashBalance).toBe(rupees('-2050'))
    expect(result.forecast.closingCash).toBe(rupees('-8199'))
    expect(result.health.state).toBe('critical')
    expect(result.health.reasons.length).toBeGreaterThan(0)
  })
  it.each(['received', 'planned'] as const)('distinguishes %s extra income from confirmed cash', status => {
    const result = proposed(preview({ id: 'income', kind: 'income', label: 'Work', amount: rupees('1000'), date: status === 'planned' ? isoDate('2026-10-20') : date, status }))
    expect(result.cashBalance).toBe(rupees(status === 'received' ? '10950' : '9950'))
    expect(result.expectedIncome).toBe(rupees(status === 'planned' ? '3000' : '2000'))
    expect(result.forecast.closingCash).toBe(rupees('4801'))
  })
  it('cancels unpaid future renewals without changing cash', () => {
    const state = initialWorkspaceState()
    const id = state.month.plan.subscriptions[0]!.id
    const draft = preview({ id: 'cancel', kind: 'cancel-subscription', subscriptionId: id }, state)
    expect(proposed(draft).cashBalance).toBe(rupees('9950'))
    expect(proposed(draft).obligationReserve).toBe(rupees('3500'))
    expect(proposed(draft).forecast.closingCash).toBe(rupees('4000'))
    expect(state.month.plan.subscriptions).toHaveLength(1)
    const committed = apply(draft, 'cancel')
    expect(committed.month.plan.subscriptions).toHaveLength(0)
    expect(workspaceReducer(committed, { type: 'undo' }).month.plan).toBe(state.month.plan)
  })
  it('preserves paid renewals and overdue bills when stopping a recurring subscription', () => {
    let state = initialWorkspaceState()
    state = workspaceReducer(state, { type: 'month', action: { type: 'add-subscription', item: { id: 'weekly', label: 'Pass', firstDueDate: isoDate('2026-10-01'), amount: rupees('100'), recurrence: { kind: 'every-days', intervalDays: 3 } } } })
    state = workspaceReducer(state, { type: 'month', action: { type: 'add-expense', item: { id: 'paid', label: 'Pass payment', date, amount: rupees('100'), obligation: { kind: 'subscription', subscriptionId: 'weekly', dueDate: isoDate('2026-10-10') } } } })
    expect(state.month.error).toBeNull()
    const result = preview({ id: 'cancel', kind: 'cancel-subscription', subscriptionId: 'weekly' }, state)
    const plan = result.preview!.proposed.plan
    expect(plan.expenses).toEqual(state.month.plan.expenses)
    expect(plan.subscriptions.find(item => item.id === 'weekly')?.endsOn).toBe('2026-10-10')
    const weekly = proposed(result).obligations.filter(item => item.label === 'Pass')
    expect(weekly.map(item => item.dueDate)).toEqual(['2026-10-01', '2026-10-04', '2026-10-07', '2026-10-10'])
    expect(weekly.at(-1)?.remaining).toBe(0)
  })
  it.each(['2000', '0'])('changes a savings target to %s without moving saved funds', target => {
    const state = initialWorkspaceState()
    const draft = preview({ id: 'target', kind: 'savings-target', goalId: state.month.plan.savingsGoals[0]!.id, target: rupees(target), targetDate: isoDate('2026-10-30') }, state)
    const result = proposed(draft)
    expect(result.cashBalance).toBe(rupees('9950'))
    expect(result.savedTotal).toBe(rupees('500'))
    expect(result.savingsReserve).toBe(rupees(target === '0' ? '0' : '1500'))
    expect(result.forecast.closingCash).toBe(rupees(target === '0' ? '4801' : '3301'))
    expect(draft.preview!.proposed.plan.savingsTransfers).toBe(state.month.plan.savingsTransfers)
  })
  it('moves funding out of this horizon when a target date changes', () => {
    const state = initialWorkspaceState()
    const result = proposed(preview({ id: 'later', kind: 'savings-target', goalId: state.month.plan.savingsGoals[0]!.id, target: rupees('2000'), targetDate: isoDate('2026-11-10') }, state))
    expect(result.savingsReserve).toBe(0)
    expect(result.forecast.closingCash).toBe(rupees('4801'))
  })
  it('shows a later proposed snapshot while leaving the real snapshot unchanged', () => {
    const draft = preview({ ...cost(), date: isoDate('2026-10-10') })
    expect(draft.month.asOf).toBe(date)
    expect(draft.preview!.proposed.asOf).toBe('2026-10-10')
    expect(proposed(draft).daysRemaining).toBe(20)
  })
  it.each([
    cost('zero', 'purchase', '0'), cost('negative', 'emergency', '-1'), { ...cost(), label: '' }, { ...cost(), id: '' },
    { ...cost(), date: isoDate('2026-10-31') },
    { id: 'bad', kind: 'cancel-subscription', subscriptionId: 'missing' },
    { id: 'bad', kind: 'savings-target', goalId: 'missing', target: rupees('100'), targetDate: date },
  ] satisfies Scenario[])('rejects invalid proposals without touching committed data: %j', scenario => {
    const state = initialWorkspaceState()
    const result = preview(scenario, state)
    expect(result.error).not.toBeNull()
    expect(result.month).toBe(state.month)
    expect(result.preview).toBeNull()
  })
})

describe('atomic Apply, duplicate prevention, and Undo', () => {
  it('applies the same ID only once across ten retries, including retries after Undo', () => {
    const initial = initialWorkspaceState()
    let state = apply(preview(cost(), initial))
    expect(state.month.plan.expenses).toHaveLength(initial.month.plan.expenses.length + 1)
    expect(state.month.plan.expenses.at(-1)?.id).toBe('what-if:decision')
    const committedPlan = state.month.plan
    for (let retry = 0; retry < 10; retry++) state = apply(state)
    expect(state.month.plan).toBe(committedPlan)
    expect(state.undoStack).toHaveLength(1)
    state = workspaceReducer(state, { type: 'undo' })
    expect(state.month.plan).toBe(initial.month.plan)
    expect(state.month.asOf).toBe(initial.month.asOf)
    state = apply(state)
    expect(state.month.plan).toBe(initial.month.plan)
    expect(preview(cost(), state).error).toMatch(/already applied/)
  })
  it('undoes multiple decisions in reverse order and permits intentional new decisions', () => {
    const initial = initialWorkspaceState()
    const first = apply(preview(cost('first'), initial), 'first')
    let state = apply(preview(cost('second'), first), 'second')
    expect(snapshot(state).cashBalance).toBe(rupees('8950'))
    state = workspaceReducer(state, { type: 'undo' })
    expect(state.month.plan).toBe(first.month.plan)
    state = workspaceReducer(state, { type: 'undo' })
    expect(state.month.plan).toBe(initial.month.plan)
    state = apply(preview(cost('new'), state), 'new')
    expect(snapshot(state).cashBalance).toBe(rupees('9450'))
  })
  it('rejects unmatched and stale applications without committing', () => {
    const draft = preview(cost())
    expect(apply(draft, 'wrong').month).toBe(draft.month)
    expect(apply(draft, 'wrong').error).toMatch(/matching preview/)
    const stale = { ...draft, revision: draft.revision + 1 }
    expect(apply(stale).month).toBe(stale.month)
    expect(apply(stale).error).toMatch(/changed after/)
  })
  it('keeps a newer preview intact when a delayed old Apply arrives', () => {
    const first = apply(preview(cost()))
    const second = preview(cost('second'), first)
    const retry = apply(second)
    expect(retry.preview).toBe(second.preview)
    expect(retry.month).toBe(second.month)
    expect(retry.undoStack).toHaveLength(1)
  })
  it('clears preview and Undo when manual edits happen so Undo cannot remove them', () => {
    const applied = apply(preview(cost()))
    const pending = preview(cost('second'), applied)
    const edited = workspaceReducer(pending, { type: 'month', action: { type: 'add-income', item: { id: 'manual', label: 'Manual', amount: rupees('100'), date, status: 'received' } } })
    expect(edited.preview).toBeNull()
    expect(edited.undoStack).toHaveLength(0)
    expect(workspaceReducer(edited, { type: 'undo' }).month.plan).toBe(edited.month.plan)
    expect(snapshot(edited).cashBalance).toBe(rupees('9550'))
  })
  it('preserves a valid preview when a manual edit fails validation', () => {
    const draft = preview(cost())
    const result = workspaceReducer(draft, { type: 'month', action: { type: 'add-expense', item: { id: 'bad', label: 'Bad', amount: rupees('-1'), date } } })
    expect(result.preview).toBe(draft.preview)
    expect(result.month.plan).toBe(draft.month.plan)
    expect(apply(result).month.plan.expenses).toHaveLength(5)
  })
  it.each(['reset-sample', 'start-fresh'] as const)('clears decision state on %s and blocks old retries', type => {
    const applied = apply(preview(cost()))
    const reset = workspaceReducer(applied, { type: 'month', action: type === 'reset-sample' ? { type } : { type, startDate: isoDate('2026-11-01') } })
    expect(reset.preview).toBeNull()
    expect(reset.undoStack).toHaveLength(0)
    expect(apply(reset).month).toBe(reset.month)
  })
  it('rejects ID collisions in the financial ledger even with a fresh decision ledger', () => {
    const applied = apply(preview(cost()))
    const imported = { ...initialWorkspaceState(), month: applied.month }
    expect(preview(cost(), imported).error).toMatch(/unique|duplicate/i)
    expect(preview(cost(), imported).month).toBe(imported.month)
  })
  it('formats exact comparison deltas even beyond the safe integer difference', () => {
    expect(moneyChange(paise(-Number.MAX_SAFE_INTEGER), paise(Number.MAX_SAFE_INTEGER))).toBe('+₹18,01,43,98,50,94,819.82')
  })
})
