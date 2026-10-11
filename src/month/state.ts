import { addDays, calculateFinancials, createPlan, initialSnapshotDate } from '../finance'
import type { Commitment, Expense, FinancialPlan, Income, ISODate, OutstandingObligation, Paise, SavingsGoal, SavingsTransfer, Subscription } from '../finance'
import { SAMPLE_AS_OF, SAMPLE_START, samplePlan } from './sample'

export interface MonthState {
  readonly plan: FinancialPlan
  readonly asOf: ISODate
  readonly source: 'sample' | 'personal'
  readonly error: string | null
  readonly notice: string
}

export type MonthAction =
  | { type: 'reset-sample' }
  | { type: 'start-fresh'; startDate: ISODate }
  | { type: 'snapshot'; date: ISODate }
  | { type: 'add-income'; item: Income }
  | { type: 'receive-income'; id: string; date: ISODate }
  | { type: 'add-expense'; item: Expense }
  | { type: 'add-commitment'; item: Commitment }
  | { type: 'add-subscription'; item: Subscription }
  | { type: 'add-goal'; item: SavingsGoal }
  | { type: 'set-savings-target'; id: string; target: Paise; targetDate: ISODate }
  | { type: 'transfer'; item: SavingsTransfer }
  | { type: 'pay'; id: string; obligation: OutstandingObligation; date: ISODate }
  | { type: 'cancel-subscription'; id: string }
  | { type: 'remove'; collection: 'incomes' | 'expenses' | 'commitments' | 'subscriptions' | 'savingsGoals' | 'savingsTransfers'; id: string }

export function initialMonthState(): MonthState {
  return { plan: samplePlan(), asOf: SAMPLE_AS_OF, source: 'sample', error: null, notice: 'Sample month loaded. Try a change to see its impact.' }
}

/** All controls commit through the same validation boundary before state changes. */
export function monthReducer(state: MonthState, action: MonthAction): MonthState {
  try {
    if (action.type === 'reset-sample') return initialMonthState()
    if (action.type === 'start-fresh') {
      const plan = createPlan(action.startDate)
      calculateFinancials(plan)
      return { plan, asOf: initialSnapshotDate(plan), source: 'personal', error: null, notice: 'Fresh month started with ₹10,000. Add your first transaction.' }
    }
    let plan = state.plan
    let asOf = state.asOf
    let notice = 'Month updated. All balances and forecasts recalculated.'
    const recordDate = (date: ISODate): void => {
      if (date > addDays(plan.startDate, plan.horizonDays - 1)) throw new RangeError('Choose a transaction date within your 30-day month.')
      if (date > asOf) asOf = date
    }
    switch (action.type) {
      case 'snapshot': {
        const postedDates = [...plan.expenses, ...plan.savingsTransfers, ...plan.incomes.filter(item => item.status === 'received')].map(item => item.date)
        if (postedDates.some(date => date > action.date)) throw new RangeError('The snapshot cannot precede recorded transactions. Remove those entries first or choose a later date.')
        asOf = action.date
        break
      }
      case 'add-income':
        if (action.item.status === 'received') recordDate(action.item.date)
        plan = { ...plan, incomes: [...plan.incomes, action.item] }
        break
      case 'receive-income':
        if (!plan.incomes.some(item => item.id === action.id && item.status === 'planned')) throw new RangeError('This income is already received or no longer exists.')
        recordDate(action.date)
        plan = { ...plan, incomes: plan.incomes.map(item => item.id === action.id ? { ...item, status: 'received', date: action.date } : item) }
        notice = 'Income received on the snapshot day. It is now confirmed cash.'
        break
      case 'add-expense':
        recordDate(action.item.date)
        plan = { ...plan, expenses: [...plan.expenses, action.item] }
        break
      case 'add-commitment': plan = { ...plan, commitments: [...plan.commitments, action.item] }; break
      case 'add-subscription': plan = { ...plan, subscriptions: [...plan.subscriptions, action.item] }; break
      case 'add-goal': plan = { ...plan, savingsGoals: [...plan.savingsGoals, action.item] }; break
      case 'set-savings-target':
        if (!plan.savingsGoals.some(item => item.id === action.id)) throw new RangeError('Savings goal no longer exists.')
        plan = { ...plan, savingsGoals: plan.savingsGoals.map(item => item.id === action.id ? { ...item, target: action.target, targetDate: action.targetDate } : item) }
        break
      case 'transfer':
        recordDate(action.item.date)
        plan = { ...plan, savingsTransfers: [...plan.savingsTransfers, action.item] }
        break
      case 'pay': {
        // Resolve again from current state; never trust an old remaining amount.
        const current = calculateFinancials(plan, asOf).obligations.find(item => JSON.stringify(item.reference) === JSON.stringify(action.obligation.reference))
        if (!current || current.remaining <= 0) throw new RangeError('This bill is already paid or no longer exists.')
        recordDate(action.date)
        const expense: Expense = { id: action.id, label: current.label, amount: current.remaining, date: action.date, obligation: current.reference }
        plan = { ...plan, expenses: [...plan.expenses, expense] }
        notice = 'Payment recorded once. Cash and the outstanding bill were updated together.'
        break
      }
      case 'cancel-subscription': {
        const subscription = plan.subscriptions.find(item => item.id === action.id)
        if (!subscription) throw new RangeError('Subscription no longer exists.')
        const paidDates = plan.expenses.flatMap(item => item.obligation?.kind === 'subscription' && item.obligation.subscriptionId === action.id ? [item.obligation.dueDate] : [])
        if (subscription.firstDueDate > asOf && paidDates.length === 0) {
          plan = { ...plan, subscriptions: plan.subscriptions.filter(item => item.id !== action.id) }
        } else {
          const endsOn = paidDates.reduce((latest, date) => date > latest ? date : latest, asOf)
          plan = { ...plan, subscriptions: plan.subscriptions.map(item => item.id === action.id ? { ...item, endsOn } : item) }
        }
        notice = 'Future renewals stopped. Existing unpaid bills and prepaid renewals are preserved.'
        break
      }
      case 'remove': {
        if (action.collection === 'commitments' && plan.expenses.some(item => item.obligation?.kind === 'commitment' && item.obligation.commitmentId === action.id)) throw new RangeError('Remove linked payments before removing this commitment.')
        if (action.collection === 'subscriptions' && plan.expenses.some(item => item.obligation?.kind === 'subscription' && item.obligation.subscriptionId === action.id)) throw new RangeError('Remove linked payments first, or stop future renewals instead.')
        if (action.collection === 'savingsGoals' && plan.savingsTransfers.some(item => item.goalId === action.id)) throw new RangeError('Remove this goal’s transfers before removing the goal.')
        plan = { ...plan, [action.collection]: plan[action.collection].filter(item => item.id !== action.id) }
        notice = 'Entry removed. All totals and forecasts recalculated.'
        break
      }
    }
    calculateFinancials(plan, asOf)
    return { ...state, plan, asOf, error: null, notice }
  } catch (error) {
    return { ...state, error: error instanceof Error ? error.message : 'Unable to update your month. Check the entry and try again.', notice: '' }
  }
}

export function transactionDate(state: MonthState): ISODate {
  return state.asOf < state.plan.startDate ? state.plan.startDate : state.asOf
}

export { SAMPLE_START }
