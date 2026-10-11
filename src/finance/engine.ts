import { addDays, addMonthsClamped, daysBetween, isoDate } from './date'
import type { ISODate } from './date'
import type {
  FinancialPlan, FinancialSnapshot, ForecastDay, HealthReason,
  ObligationReference, OutstandingObligation, SavingsProgress, Subscription,
} from './model'
import { initialSnapshotDate } from './model'
import { fromBigInt, negatePaise, paise, sumPaise } from './money'
import type { Paise } from './money'

function nonnegative(value: Paise): void {
  if (paise(value) < 0) throw new RangeError('Amounts must be nonnegative.')
}

function positive(value: Paise): void {
  if (paise(value) <= 0) throw new RangeError('Transaction and obligation amounts must be positive.')
}

function isRenewal(subscription: Subscription, date: ISODate): boolean {
  isoDate(date)
  if (date < subscription.firstDueDate || (subscription.endsOn && date > subscription.endsOn)) return false
  if (subscription.recurrence.kind === 'every-days') {
    return daysBetween(subscription.firstDueDate, date) % subscription.recurrence.intervalDays === 0
  }
  const monthDifference = (Number(date.slice(0, 4)) - Number(subscription.firstDueDate.slice(0, 4))) * 12
    + Number(date.slice(5, 7)) - Number(subscription.firstDueDate.slice(5, 7))
  return addMonthsClamped(subscription.firstDueDate, monthDifference) === date
}

function renewalDates(subscription: Subscription, start: ISODate, end: ISODate): ISODate[] {
  const dates: ISODate[] = []
  const limit = subscription.endsOn && subscription.endsOn < end ? subscription.endsOn : end
  if (limit < start || subscription.firstDueDate > limit) return dates
  if (subscription.recurrence.kind === 'every-days') {
    const interval = subscription.recurrence.intervalDays
    const firstOffset = Math.max(0, Math.ceil(daysBetween(subscription.firstDueDate, start) / interval)) * interval
    const lastOffset = daysBetween(subscription.firstDueDate, limit)
    for (let offset = firstOffset; offset <= lastOffset; offset += interval) {
      dates.push(addDays(subscription.firstDueDate, offset))
    }
  } else {
    const firstMonth = Math.max(0, (Number(start.slice(0, 4)) - Number(subscription.firstDueDate.slice(0, 4))) * 12
      + Number(start.slice(5, 7)) - Number(subscription.firstDueDate.slice(5, 7)))
    const lastMonth = (Number(limit.slice(0, 4)) - Number(subscription.firstDueDate.slice(0, 4))) * 12
      + Number(limit.slice(5, 7)) - Number(subscription.firstDueDate.slice(5, 7))
    for (let month = firstMonth; month <= lastMonth; month++) {
      const date = addMonthsClamped(subscription.firstDueDate, month)
      if (date >= start && date <= limit) dates.push(date)
    }
  }
  return dates
}

function validate(plan: FinancialPlan, asOf: ISODate): ISODate {
  isoDate(plan.startDate)
  isoDate(asOf)
  if (!Number.isSafeInteger(plan.horizonDays) || plan.horizonDays < 1 || plan.horizonDays > 366) {
    throw new RangeError('Horizon must contain between 1 and 366 days.')
  }
  const end = addDays(plan.startDate, plan.horizonDays - 1)
  if (asOf < initialSnapshotDate(plan) || asOf > end) throw new RangeError('Snapshot date is outside the horizon.')
  nonnegative(plan.openingCash)
  const ids = new Set<string>()
  function identity(id: string): void {
    if (!id.trim() || ids.has(id)) throw new RangeError('Every record must have a unique, nonempty ID.')
    ids.add(id)
  }
  function dateInPlan(date: ISODate): void {
    if (isoDate(date) < plan.startDate) throw new RangeError('Record date precedes the plan start.')
  }
  function postedDate(date: ISODate): void {
    dateInPlan(date)
    if (date > asOf) throw new RangeError('Posted transactions cannot be dated after the snapshot.')
  }
  const commitments = new Map(plan.commitments.map(item => [item.id, item]))
  const subscriptions = new Map(plan.subscriptions.map(item => [item.id, item]))
  const goals = new Map(plan.savingsGoals.map(item => [item.id, item]))

  for (const item of plan.commitments) {
    identity(item.id); positive(item.amount); dateInPlan(item.dueDate)
  }
  for (const item of plan.subscriptions) {
    identity(item.id); positive(item.amount); isoDate(item.firstDueDate)
    if (item.endsOn && isoDate(item.endsOn) < item.firstDueDate) throw new RangeError('Subscription end precedes its first renewal.')
    if (item.recurrence.kind === 'every-days') {
      if (!Number.isSafeInteger(item.recurrence.intervalDays) || item.recurrence.intervalDays < 1 || item.recurrence.intervalDays > 366) {
        throw new RangeError('Subscription interval must be between 1 and 366 days.')
      }
    } else if (item.recurrence.kind !== 'monthly') throw new RangeError('Unknown subscription recurrence.')
  }
  for (const item of plan.savingsGoals) {
    identity(item.id); nonnegative(item.target); nonnegative(item.openingSaved); dateInPlan(item.targetDate)
  }
  for (const item of plan.incomes) {
    identity(item.id); positive(item.amount); dateInPlan(item.date)
    if (item.status === 'received') postedDate(item.date)
    else if (item.status !== 'planned') throw new RangeError('Unknown income status.')
  }
  for (const item of plan.expenses) {
    identity(item.id); positive(item.amount); postedDate(item.date)
    if (item.forecastTreatment !== undefined && item.forecastTreatment !== 'pace' && item.forecastTreatment !== 'one-off') {
      throw new RangeError('Unknown expense forecast treatment.')
    }
    const ref = item.obligation
    if (ref?.kind === 'commitment') {
      if (!commitments.has(ref.commitmentId)) throw new RangeError('Expense references an unknown commitment.')
    } else if (ref?.kind === 'subscription') {
      const subscription = subscriptions.get(ref.subscriptionId)
      if (!subscription || !isRenewal(subscription, ref.dueDate)) throw new RangeError('Expense references an invalid subscription renewal.')
    } else if (ref) throw new RangeError('Unknown expense obligation reference.')
  }
  for (const item of plan.savingsTransfers) {
    identity(item.id); positive(item.amount); postedDate(item.date)
    if (!goals.has(item.goalId)) throw new RangeError('Transfer references an unknown savings goal.')
    if (item.direction !== 'deposit' && item.direction !== 'withdrawal') throw new RangeError('Unknown savings transfer direction.')
  }
  return end
}

function sameObligation(first: ObligationReference, second: ObligationReference): boolean {
  if (first.kind === 'commitment' && second.kind === 'commitment') return first.commitmentId === second.commitmentId
  if (first.kind === 'subscription' && second.kind === 'subscription') {
    return first.subscriptionId === second.subscriptionId && first.dueDate === second.dueDate
  }
  return false
}

function outstanding(plan: FinancialPlan, asOf: ISODate, end: ISODate): OutstandingObligation[] {
  const items: OutstandingObligation[] = []
  function add(reference: ObligationReference, label: string, dueDate: ISODate, amount: Paise): void {
    const paid = sumPaise(plan.expenses.filter(expense => expense.obligation && sameObligation(expense.obligation, reference)).map(expense => expense.amount))
    const remaining = paise(Math.max(0, sumPaise([amount, negatePaise(paid)])))
    items.push({ reference, label, dueDate, amount, paid, remaining, overdue: dueDate <= asOf && remaining > 0 })
  }
  for (const item of plan.commitments) {
    if (item.dueDate <= end) add({ kind: 'commitment', commitmentId: item.id }, item.label, item.dueDate, item.amount)
  }
  for (const item of plan.subscriptions) {
    for (const dueDate of renewalDates(item, plan.startDate, end)) {
      add({ kind: 'subscription', subscriptionId: item.id, dueDate }, item.label, dueDate, item.amount)
    }
  }
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.label.localeCompare(b.label))
}

function savingsProgress(plan: FinancialPlan, end: ISODate): SavingsProgress[] {
  return plan.savingsGoals.map(goal => {
    let saved = goal.openingSaved
    const transfers = plan.savingsTransfers.filter(item => item.goalId === goal.id)
    const dates = [...new Set(transfers.map(item => item.date))].sort()
    for (const date of dates) {
      // Daily snapshots have no intraday ordering: same-day deposits/withdrawals are netted.
      saved = sumPaise([saved, ...transfers.filter(item => item.date === date).map(item => item.direction === 'deposit' ? item.amount : negatePaise(item.amount))])
      if (saved < 0) throw new RangeError('Savings withdrawals exceed saved funds.')
    }
    const remaining = paise(Math.max(0, sumPaise([goal.target, negatePaise(saved)])))
    return { goalId: goal.id, saved, remaining, reserved: goal.targetDate <= end ? remaining : paise(0), targetDate: goal.targetDate }
  })
}

function allowance(available: Paise, days: number): Paise {
  return days === 0 ? paise(0) : fromBigInt(BigInt(Math.max(0, available)) / BigInt(days))
}

/** Pure end-of-day snapshot: no clock reads, storage, mutation, or floating-point money. */
export function calculateFinancials(plan: FinancialPlan, asOf: ISODate = initialSnapshotDate(plan)): FinancialSnapshot {
  const endDate = validate(plan, asOf)
  const daysElapsed = Math.max(0, daysBetween(plan.startDate, asOf) + 1)
  const daysRemaining = plan.horizonDays - daysElapsed
  const receivedIncome = sumPaise(plan.incomes.filter(item => item.status === 'received').map(item => item.amount))
  const futureIncomes = plan.incomes.filter(item => item.status === 'planned' && item.date > asOf && item.date <= endDate)
  const expectedIncome = sumPaise(futureIncomes.map(item => item.amount))
  const overdueIncome = sumPaise(plan.incomes.filter(item => item.status === 'planned' && item.date <= asOf).map(item => item.amount))
  const expensesPaid = sumPaise(plan.expenses.map(item => item.amount))
  const netSavingsDeposits = sumPaise(plan.savingsTransfers.map(item => item.direction === 'deposit' ? item.amount : negatePaise(item.amount)))
  const cashBalance = sumPaise([plan.openingCash, receivedIncome, negatePaise(expensesPaid), negatePaise(netSavingsDeposits)])
  const obligations = outstanding(plan, asOf, endDate)
  const savings = savingsProgress(plan, endDate)
  const savedTotal = sumPaise(savings.map(item => item.saved))
  const obligationReserve = sumPaise(obligations.map(item => item.remaining))
  const savingsReserve = sumPaise(savings.map(item => item.reserved))
  const spendableCash = sumPaise([cashBalance, negatePaise(obligationReserve), negatePaise(savingsReserve)])
  const observedDiscretionarySpending = sumPaise(plan.expenses.filter(item => !item.obligation && item.forecastTreatment !== 'one-off').map(item => item.amount))
  // Cumulative rational arithmetic distributes fractional average paise without rounding drift.
  const spendingThroughDay = (day: number): Paise => daysElapsed === 0 ? paise(0)
    : fromBigInt(BigInt(observedDiscretionarySpending) * BigInt(day) / BigInt(daysElapsed))
  const projectedDiscretionarySpending = spendingThroughDay(daysRemaining)
  const days: ForecastDay[] = []
  let balance = cashBalance
  let lowestCash = balance
  let firstShortfallDate: ISODate | null = balance < 0 ? asOf : null
  for (let day = 1; day <= daysRemaining; day++) {
    const date = addDays(asOf, day)
    const expected = sumPaise(futureIncomes.filter(item => item.date === date).map(item => item.amount))
    // Overdue unpaid liabilities and goals are due on the first remaining day.
    const dueNow = (dueDate: ISODate): boolean => dueDate === date || (day === 1 && dueDate <= asOf)
    const payments = sumPaise(obligations.filter(item => dueNow(item.dueDate)).map(item => item.remaining))
    const funding = sumPaise(savings.filter(item => dueNow(item.targetDate)).map(item => item.reserved))
    const discretionary = sumPaise([spendingThroughDay(day), negatePaise(spendingThroughDay(day - 1))])
    balance = sumPaise([balance, expected, negatePaise(payments), negatePaise(funding), negatePaise(discretionary)])
    lowestCash = paise(Math.min(lowestCash, balance))
    if (balance < 0 && firstShortfallDate === null) firstShortfallDate = date
    days.push({ date, expectedIncome: expected, obligationPayments: payments, savingsFunding: funding, discretionarySpending: discretionary, closingCash: balance })
  }
  // On the final day, show outstanding liabilities as a terminal settlement scenario.
  const closingCash = daysRemaining === 0 ? spendableCash : balance
  lowestCash = paise(Math.min(lowestCash, closingCash))
  if (closingCash < 0 && firstShortfallDate === null) firstShortfallDate = endDate
  const closingCashWithoutPlannedIncome = sumPaise([closingCash, negatePaise(expectedIncome)])
  const reasons: HealthReason[] = []
  if (cashBalance < 0) reasons.push({ code: 'negative-cash', message: 'Confirmed cash is below zero.', amount: paise(negatePaise(cashBalance)) })
  if (lowestCash < 0) reasons.push({ code: 'forecast-shortfall', message: 'The forecast reaches a negative daily closing balance.', amount: paise(negatePaise(lowestCash)) })
  if (spendableCash < 0) reasons.push({ code: 'reserves-underfunded', message: 'Confirmed cash cannot cover outstanding bills and savings targets within this horizon.', amount: paise(negatePaise(spendableCash)) })
  const overdueObligations = sumPaise(obligations.filter(item => item.overdue).map(item => item.remaining))
  if (overdueObligations > 0) reasons.push({ code: 'overdue-obligation', message: 'Unpaid obligations have reached or passed their due date.', amount: overdueObligations })
  if (overdueIncome > 0) reasons.push({ code: 'overdue-income', message: 'Planned income has not arrived by its date and is excluded from the forecast.', amount: overdueIncome })
  const missedSavings = sumPaise(savings.filter(item => item.targetDate <= asOf).map(item => item.remaining))
  if (missedSavings > 0) reasons.push({ code: 'savings-deadline-missed', message: 'One or more savings targets remain unfunded at their deadline.', amount: missedSavings })
  if (closingCash >= 0 && closingCashWithoutPlannedIncome < 0) reasons.push({ code: 'depends-on-planned-income', message: 'The closing forecast stays nonnegative only if planned income arrives.', amount: paise(negatePaise(closingCashWithoutPlannedIncome)) })
  const state = cashBalance < 0 || lowestCash < 0 ? 'critical' : reasons.length > 0 ? 'caution' : 'healthy'
  if (reasons.length === 0) reasons.push({ code: 'on-track', message: 'Confirmed cash covers in-horizon reserves and the observed spending forecast remains nonnegative.', amount: paise(0) })
  return {
    asOf, endDate, daysElapsed, daysRemaining, receivedIncome, expectedIncome, overdueIncome,
    expensesPaid, netSavingsDeposits, cashBalance, savedTotal, obligations, savings,
    obligationReserve, savingsReserve, spendableCash,
    dailyAllowance: allowance(spendableCash, daysRemaining),
    projectedDailyAllowance: allowance(sumPaise([spendableCash, expectedIncome]), daysRemaining),
    forecast: { observedDiscretionarySpending, observedDays: daysElapsed, projectedDiscretionarySpending, closingCash, closingCashWithoutPlannedIncome, lowestCash, firstShortfallDate, days },
    health: { state, reasons },
  }
}
