import { describe, expect, it } from 'vitest'
import { addDays, isoDate } from './date'
import { calculateFinancials } from './engine'
import { createPlan } from './model'
import type { FinancialPlan } from './model'
import { paise, rupees } from './money'

const start = isoDate('2026-10-01')
const day = (number: number) => addDays(start, number - 1)
const amount = rupees
const plan = (overrides: Partial<FinancialPlan> = {}): FinancialPlan => ({ ...createPlan(start), ...overrides })
const commitment = { id: 'rent', label: 'Rent', amount: amount('3000'), dueDate: day(10) }
const goal = { id: 'buffer', label: 'Buffer', target: amount('2000'), openingSaved: amount('0'), targetDate: day(30) }
const subscription = {
  id: 'music', label: 'Music', amount: amount('100'), firstDueDate: day(3),
  recurrence: { kind: 'every-days' as const, intervalDays: 7 },
}

describe('money and calendar boundaries', () => {
  it('parses decimal rupees exactly into integer paise', () => {
    expect(amount('10000')).toBe(1_000_000)
    expect(amount('0.29')).toBe(29)
    expect(amount('-1.5')).toBe(-150)
    expect(amount('0002.01')).toBe(201)
  })
  it('rejects fractional paise, unsafe money, and malformed decimal input', () => {
    for (const value of [NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) expect(() => paise(value)).toThrow()
    for (const value of ['1.001', '1e3', '', '₹100', ' 2', '9007199254740992']) expect(() => amount(value)).toThrow()
  })
  it('rejects impossible and ambiguous dates and handles leap days', () => {
    expect(() => isoDate('2026-02-29')).toThrow()
    expect(() => isoDate('01/10/2026')).toThrow()
    expect(addDays(isoDate('2028-02-28'), 1)).toBe('2028-02-29')
    expect(addDays(isoDate('2026-12-31'), 1)).toBe('2027-01-01')
  })
})

describe('cash, reserves, and double counting', () => {
  it('starts with ₹10,000 for exactly 30 days, without counting it as income', () => {
    const result = calculateFinancials(plan())
    expect(result.cashBalance).toBe(1_000_000)
    expect(result.receivedIncome).toBe(0)
    expect(result.daysRemaining).toBe(30)
    expect(result.endDate).toBe(day(30))
    expect(result.dailyAllowance).toBe(33_333)
    expect(result.forecast.closingCash).toBe(1_000_000)
    expect(result.health.state).toBe('healthy')
  })
  it('separates confirmed cash from planned and overdue income', () => {
    const result = calculateFinancials(plan({ incomes: [
      { id: 'salary', label: 'Salary', amount: amount('1000'), date: day(1), status: 'received' },
      { id: 'freelance', label: 'Freelance', amount: amount('2000'), date: day(20), status: 'planned' },
      { id: 'late', label: 'Late', amount: amount('500'), date: day(2), status: 'planned' },
      { id: 'next-month', label: 'Later', amount: amount('5000'), date: day(31), status: 'planned' },
    ] }), day(5))
    expect(result.cashBalance).toBe(amount('11000'))
    expect(result.expectedIncome).toBe(amount('2000'))
    expect(result.overdueIncome).toBe(amount('500'))
    expect(result.forecast.closingCash).toBe(amount('13000'))
    expect(result.health.reasons.map(item => item.code)).toContain('overdue-income')
  })
  it('reduces a commitment reserve by a partial payment, without charging twice', () => {
    const result = calculateFinancials(plan({ commitments: [commitment], expenses: [
      { id: 'rent-part', label: 'Rent payment', amount: amount('1000'), date: day(2), obligation: { kind: 'commitment', commitmentId: 'rent' } },
      { id: 'food', label: 'Food', amount: amount('500'), date: day(2) },
    ] }), day(2))
    expect(result.cashBalance).toBe(amount('8500'))
    expect(result.obligationReserve).toBe(amount('2000'))
    expect(result.spendableCash).toBe(amount('6500'))
    expect(result.forecast.observedDiscretionarySpending).toBe(amount('500'))
    expect(result.forecast.days.find(item => item.date === day(10))?.obligationPayments).toBe(amount('2000'))
    expect(result.forecast.closingCash).toBe(amount('-500')) // 28 × ₹250 future discretionary
  })
  it('replaces planned income with received income without changing the total forecast', () => {
    const income = { id: 'salary', label: 'Salary', amount: amount('2000'), date: day(5) }
    const before = calculateFinancials(plan({ incomes: [{ ...income, status: 'planned' }] }), day(4))
    const after = calculateFinancials(plan({ incomes: [{ ...income, status: 'received' }] }), day(5))
    expect(after.cashBalance - before.cashBalance).toBe(income.amount)
    expect(after.expectedIncome).toBe(0)
    expect(after.forecast.closingCash).toBe(before.forecast.closingCash)
  })
  it('fully settles multiple linked payments and treats overpayment as actual cash outflow', () => {
    const result = calculateFinancials(plan({ commitments: [commitment], expenses: [
      { id: 'part1', label: 'Rent', amount: amount('1000'), date: day(1), obligation: { kind: 'commitment', commitmentId: 'rent' } },
      { id: 'part2', label: 'Rent', amount: amount('2200'), date: day(2), obligation: { kind: 'commitment', commitmentId: 'rent' } },
    ] }), day(2))
    expect(result.cashBalance).toBe(amount('6800'))
    expect(result.obligationReserve).toBe(0)
    expect(result.forecast.closingCash).toBe(amount('6800'))
    expect(result.obligations[0]?.paid).toBe(amount('3200'))
  })
  it('keeps reserves unchanged economically when a bill is paid', () => {
    const before = calculateFinancials(plan({ commitments: [commitment] }))
    const after = calculateFinancials(plan({ commitments: [commitment], expenses: [
      { id: 'rent-paid', label: 'Rent', amount: commitment.amount, date: day(1), obligation: { kind: 'commitment', commitmentId: 'rent' } },
    ] }), day(1))
    expect(after.spendableCash).toBe(before.spendableCash)
    expect(after.forecast.closingCash).toBe(before.forecast.closingCash)
  })
  it('excludes obligations and savings deadlines after the horizon', () => {
    const result = calculateFinancials(plan({ commitments: [{ ...commitment, dueDate: day(31) }], savingsGoals: [{ ...goal, targetDate: day(31) }] }))
    expect(result.obligationReserve).toBe(0)
    expect(result.savingsReserve).toBe(0)
    expect(result.savings[0]?.remaining).toBe(amount('2000'))
  })
})

describe('subscription occurrences', () => {
  it('generates weekly bills and settles only the referenced renewal', () => {
    const result = calculateFinancials(plan({ subscriptions: [subscription], expenses: [
      { id: 'music-paid', label: 'Music', amount: amount('100'), date: day(3), obligation: { kind: 'subscription', subscriptionId: 'music', dueDate: day(3) } },
    ] }), day(3))
    expect(result.obligations.map(item => item.dueDate)).toEqual([day(3), day(10), day(17), day(24)])
    expect(result.obligationReserve).toBe(amount('300'))
    expect(result.cashBalance).toBe(amount('9900'))
    expect(result.forecast.closingCash).toBe(amount('9600'))
  })
  it('clamps month ends to February without drifting the March renewal', () => {
    const result = calculateFinancials(plan({ startDate: isoDate('2028-01-31'), horizonDays: 61, subscriptions: [
      { ...subscription, firstDueDate: isoDate('2028-01-31'), recurrence: { kind: 'monthly' } },
    ] }))
    expect(result.obligations.map(item => item.dueDate)).toEqual(['2028-01-31', '2028-02-29', '2028-03-31'])
  })
  it('starts old monthly subscriptions at the correct in-horizon renewal', () => {
    const result = calculateFinancials(plan({ subscriptions: [
      { ...subscription, firstDueDate: isoDate('2020-01-15'), recurrence: { kind: 'monthly' } },
    ] }))
    expect(result.obligations.map(item => item.dueDate)).toEqual([day(15)])
  })
  it('honors inclusive cancellation dates and both horizon edges', () => {
    const result = calculateFinancials(plan({ subscriptions: [{ ...subscription, firstDueDate: day(1), endsOn: day(15) }] }))
    expect(result.obligations.map(item => item.dueDate)).toEqual([day(1), day(8), day(15)])
    const edges = calculateFinancials(plan({ subscriptions: [{ ...subscription, firstDueDate: day(1), recurrence: { kind: 'every-days', intervalDays: 29 } }] }))
    expect(edges.obligations.map(item => item.dueDate)).toEqual([day(1), day(30)])
  })
})

describe('savings accounting', () => {
  it('reserves only the unfunded target and never subtracts opening savings from cash', () => {
    const result = calculateFinancials(plan({ savingsGoals: [{ ...goal, openingSaved: amount('500') }], savingsTransfers: [
      { id: 'save', goalId: 'buffer', amount: amount('1000'), direction: 'deposit', date: day(1) },
    ] }), day(1))
    expect(result.savedTotal).toBe(amount('1500'))
    expect(result.cashBalance).toBe(amount('9000'))
    expect(result.savingsReserve).toBe(amount('500'))
    expect(result.spendableCash).toBe(amount('8500'))
    expect(result.forecast.closingCash).toBe(amount('8500'))
  })
  it('withdrawals restore cash and increase the unfunded savings target', () => {
    const result = calculateFinancials(plan({ savingsGoals: [{ ...goal, openingSaved: amount('2000') }], savingsTransfers: [
      { id: 'withdraw', goalId: 'buffer', amount: amount('500'), direction: 'withdrawal', date: day(1) },
    ] }), day(1))
    expect(result.netSavingsDeposits).toBe(amount('-500'))
    expect(result.cashBalance).toBe(amount('10500'))
    expect(result.savedTotal).toBe(amount('1500'))
    expect(result.savingsReserve).toBe(amount('500'))
    expect(result.forecast.closingCash).toBe(amount('10000'))
  })
  it('does not duplicate savings funding after a deposit completes the goal', () => {
    const input = plan({ savingsGoals: [goal], savingsTransfers: [
      { id: 'save', goalId: 'buffer', amount: goal.target, direction: 'deposit', date: day(1) },
    ] })
    const result = calculateFinancials(input, day(1))
    expect(result.savingsReserve).toBe(0)
    expect(result.forecast.closingCash).toBe(amount('8000'))
    expect(result.forecast.days.every(item => item.savingsFunding === 0)).toBe(true)
  })
  it('rejects historical savings overdrafts even if a later deposit repairs the total', () => {
    expect(() => calculateFinancials(plan({ savingsGoals: [goal], savingsTransfers: [
      { id: 'withdraw', goalId: 'buffer', amount: amount('100'), direction: 'withdrawal', date: day(1) },
      { id: 'deposit', goalId: 'buffer', amount: amount('100'), direction: 'deposit', date: day(2) },
    ] }), day(2))).toThrow('withdrawals exceed')
  })
})

describe('allowance, forecasts, and health explanations', () => {
  it('calculates allowance from confirmed cash after all reserves', () => {
    const result = calculateFinancials(plan({ commitments: [commitment], savingsGoals: [goal], incomes: [
      { id: 'future', label: 'Future', amount: amount('1000'), date: day(20), status: 'planned' },
    ] }))
    expect(result.dailyAllowance).toBe(16_666)
    expect(result.projectedDailyAllowance).toBe(20_000)
  })
  it('distributes fractional average paise without cumulative rounding drift', () => {
    const result = calculateFinancials(plan({ expenses: [{ id: 'food', label: 'Food', amount: paise(100), date: day(1) }] }), day(3))
    expect(result.forecast.days.slice(0, 3).map(item => item.discretionarySpending)).toEqual([33, 33, 34])
    expect(result.forecast.projectedDiscretionarySpending).toBe(900)
    expect(result.forecast.closingCash).toBe(999_000)
  })
  it('detects an early cash shortfall even when later income makes month-end positive', () => {
    const result = calculateFinancials(plan({ commitments: [{ ...commitment, amount: amount('12000'), dueDate: day(5) }], incomes: [
      { id: 'late-salary', label: 'Salary', amount: amount('5000'), date: day(20), status: 'planned' },
    ] }))
    expect(result.forecast.closingCash).toBe(amount('3000'))
    expect(result.forecast.lowestCash).toBe(amount('-2000'))
    expect(result.forecast.firstShortfallDate).toBe(day(5))
    expect(result.health.state).toBe('critical')
    expect(result.health.reasons).toContainEqual(expect.objectContaining({ code: 'forecast-shortfall', amount: amount('2000') }))
  })
  it('explains reliance on planned income and clamps the safe allowance to zero', () => {
    const result = calculateFinancials(plan({ commitments: [{ ...commitment, amount: amount('12000'), dueDate: day(20) }], incomes: [
      { id: 'salary', label: 'Salary', amount: amount('5000'), date: day(5), status: 'planned' },
    ] }))
    expect(result.dailyAllowance).toBe(0)
    expect(result.projectedDailyAllowance).toBe(10_000)
    expect(result.health.state).toBe('caution')
    expect(result.health.reasons.map(item => item.code)).toContain('depends-on-planned-income')
  })
  it('flags overdue bills and missed savings deadlines, carrying them into the next forecast day', () => {
    const result = calculateFinancials(plan({ commitments: [{ ...commitment, dueDate: day(2) }], savingsGoals: [{ ...goal, targetDate: day(2) }] }), day(2))
    expect(result.health.state).toBe('caution')
    expect(result.health.reasons.map(item => item.code)).toEqual(['overdue-obligation', 'savings-deadline-missed'])
    expect(result.forecast.days[0]?.obligationPayments).toBe(amount('3000'))
    expect(result.forecast.days[0]?.savingsFunding).toBe(amount('2000'))
  })
  it('handles the final day without division by zero and includes unsettled reserves', () => {
    const result = calculateFinancials(plan({ commitments: [{ ...commitment, amount: amount('12000'), dueDate: day(30) }] }), day(30))
    expect(result.daysRemaining).toBe(0)
    expect(result.dailyAllowance).toBe(0)
    expect(result.forecast.days).toEqual([])
    expect(result.forecast.closingCash).toBe(amount('-2000'))
    expect(result.forecast.firstShortfallDate).toBe(day(30))
    expect(result.health.state).toBe('critical')
  })
  it('reports negative confirmed cash and the amount of the deficit', () => {
    const result = calculateFinancials(plan({ expenses: [{ id: 'emergency', label: 'Emergency', amount: amount('11000'), date: day(1) }] }), day(1))
    expect(result.cashBalance).toBe(amount('-1000'))
    expect(result.health.state).toBe('critical')
    expect(result.health.reasons).toContainEqual(expect.objectContaining({ code: 'negative-cash', amount: amount('1000') }))
  })
})

describe('validation, purity, and accounting invariants', () => {
  it('rejects duplicate IDs instead of counting an imported record twice', () => {
    const entry = { id: 'same', label: 'Food', amount: amount('100'), date: day(1) }
    expect(() => calculateFinancials(plan({ expenses: [entry, entry] }), day(1))).toThrow('unique')
    expect(() => calculateFinancials(plan({ incomes: [
      { ...entry, status: 'received' }, { ...entry, status: 'planned' },
    ] }), day(1))).toThrow('unique')
  })
  it('rejects unknown references, invalid renewals, and invalid intervals', () => {
    expect(() => calculateFinancials(plan({ expenses: [{ id: 'x', label: 'Bill', amount: amount('100'), date: day(1), obligation: { kind: 'commitment', commitmentId: 'missing' } }] }), day(1))).toThrow('unknown commitment')
    expect(() => calculateFinancials(plan({ subscriptions: [subscription], expenses: [{ id: 'x', label: 'Bill', amount: amount('100'), date: day(1), obligation: { kind: 'subscription', subscriptionId: 'music', dueDate: day(4) } }] }), day(1))).toThrow('invalid subscription')
    expect(() => calculateFinancials(plan({ subscriptions: [{ ...subscription, recurrence: { kind: 'every-days', intervalDays: 0 } }] }))).toThrow('interval')
    expect(() => calculateFinancials(plan({ savingsTransfers: [{ id: 'x', goalId: 'missing', amount: amount('100'), direction: 'deposit', date: day(1) }] }), day(1))).toThrow('unknown savings')
  })
  it('rejects future posted transactions, invalid snapshots, and negative amounts', () => {
    expect(() => calculateFinancials(plan({ expenses: [{ id: 'x', label: 'Food', amount: amount('100'), date: day(2) }] }), day(1))).toThrow('after the snapshot')
    expect(() => calculateFinancials(plan({ incomes: [{ id: 'x', label: 'Salary', amount: amount('100'), date: day(2), status: 'received' }] }), day(1))).toThrow('after the snapshot')
    expect(() => calculateFinancials(plan(), day(31))).toThrow('outside the horizon')
    expect(() => calculateFinancials(plan(), day(-1))).toThrow('outside the horizon')
    expect(() => calculateFinancials(plan({ commitments: [{ ...commitment, amount: amount('-1') }] }))).toThrow('positive')
    expect(() => calculateFinancials(plan({ horizonDays: 0 }))).toThrow('Horizon')
  })
  it('fails explicitly on arithmetic overflow rather than silently losing precision', () => {
    expect(() => calculateFinancials(plan({ openingCash: paise(Number.MAX_SAFE_INTEGER), incomes: [
      { id: 'x', label: 'Income', amount: paise(1), date: day(1), status: 'received' },
    ] }), day(1))).toThrow('safe integer range')
  })
  it('uses exact intermediate arithmetic when forecast multiplication exceeds number precision', () => {
    const cost = paise(3_000_000_000_000_001)
    const result = calculateFinancials(plan({ openingCash: paise(Number.MAX_SAFE_INTEGER), expenses: [
      { id: 'large', label: 'Large purchase', amount: cost, date: day(1) },
    ] }), day(10))
    expect(result.forecast.projectedDiscretionarySpending).toBe(6_000_000_000_000_002)
    expect(result.forecast.closingCash).toBe(7_199_254_740_988)
  })
  it('is deterministic on frozen inputs and does not mutate any record', () => {
    const input = plan({ commitments: [Object.freeze(commitment)], subscriptions: [Object.freeze(subscription)] })
    Object.values(input).forEach(value => { if (Array.isArray(value)) Object.freeze(value) })
    Object.freeze(input)
    const original = JSON.stringify(input)
    expect(calculateFinancials(input)).toEqual(calculateFinancials(input))
    expect(JSON.stringify(input)).toBe(original)
  })
  it('preserves cash conservation and forecast totals across varied transactions', () => {
    for (let i = 1; i <= 25; i++) {
      const result = calculateFinancials(plan({ commitments: [commitment], savingsGoals: [goal], incomes: [
        { id: 'income', label: 'Income', amount: paise(i * 173), date: day(1), status: 'received' },
      ], expenses: [
        { id: 'food', label: 'Food', amount: paise(i * 97), date: day(1) },
        { id: 'bill', label: 'Partial rent', amount: paise(i * 101), date: day(1), obligation: { kind: 'commitment', commitmentId: 'rent' } },
      ], savingsTransfers: [
        { id: 'save', goalId: 'buffer', amount: paise(i * 53), date: day(1), direction: 'deposit' },
      ] }), day(1))
      expect(result.cashBalance + result.expensesPaid + result.netSavingsDeposits).toBe(1_000_000 + result.receivedIncome)
      expect(result.spendableCash + result.obligationReserve + result.savingsReserve).toBe(result.cashBalance)
      expect(result.forecast.closingCash).toBe(result.cashBalance + result.expectedIncome - result.obligationReserve - result.savingsReserve - result.forecast.projectedDiscretionarySpending)
      expect(result.forecast.days.reduce((sum, item) => sum + item.discretionarySpending, 0)).toBe(result.forecast.projectedDiscretionarySpending)
      expect(Number.isSafeInteger(result.dailyAllowance)).toBe(true)
    }
  })
})

describe('one-off forecast treatment', () => {
  it('charges one-off costs once while keeping ordinary expenses in the observed pace', () => {
    const ordinary = { id: 'lunch', label: 'Lunch', amount: amount('70'), date: day(7) }
    const base = calculateFinancials(plan({ expenses: [ordinary] }), day(7))
    const marked = calculateFinancials(plan({ expenses: [ordinary, { id: 'repair', label: 'Repair', amount: amount('500'), date: day(7), forecastTreatment: 'one-off' }] }), day(7))
    const unmarked = calculateFinancials(plan({ expenses: [ordinary, { id: 'repair', label: 'Repair', amount: amount('500'), date: day(7) }] }), day(7))
    expect(marked.cashBalance).toBe(base.cashBalance - 50_000)
    expect(marked.forecast.closingCash).toBe(base.forecast.closingCash - 50_000)
    expect(marked.forecast.days.map(item => item.discretionarySpending)).toEqual(base.forecast.days.map(item => item.discretionarySpending))
    expect(unmarked.forecast.closingCash).toBeLessThan(marked.forecast.closingCash)
  })
  it('validates forecast treatment on runtime data', () => {
    const invalid = JSON.parse('{"id":"bad","label":"Bad","amount":100,"date":"2026-10-07","forecastTreatment":"unknown"}') as FinancialPlan['expenses'][number]
    expect(() => calculateFinancials(plan({ expenses: [invalid] }), day(7))).toThrow('Unknown expense forecast treatment.')
  })
})
