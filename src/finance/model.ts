import { addDays, isoDate } from './date'
import type { ISODate } from './date'
import { paise } from './money'
import type { Paise } from './money'

export const INITIAL_BUDGET = paise(1_000_000) // ₹10,000
export const HORIZON_DAYS = 30

export interface Income {
  readonly id: string
  readonly label: string
  readonly amount: Paise
  readonly date: ISODate
  readonly status: 'planned' | 'received'
}

export type ObligationReference =
  | { readonly kind: 'commitment'; readonly commitmentId: string }
  | { readonly kind: 'subscription'; readonly subscriptionId: string; readonly dueDate: ISODate }

/** Posted expenses only. A link settles an obligation; it never creates another cash debit. */
export interface Expense {
  readonly id: string
  readonly label: string
  readonly amount: Paise
  readonly date: ISODate
  readonly obligation?: ObligationReference
  /** A marked one-off cost is charged once, without increasing the future spending pace. */
  readonly forecastTreatment?: 'pace' | 'one-off'
}

export interface Commitment {
  readonly id: string
  readonly label: string
  readonly amount: Paise
  readonly dueDate: ISODate
}

export interface Subscription {
  readonly id: string
  readonly label: string
  readonly amount: Paise
  readonly firstDueDate: ISODate
  readonly recurrence: { readonly kind: 'monthly' } | { readonly kind: 'every-days'; readonly intervalDays: number }
  /** Last permitted renewal date, inclusive. Cancellation does not delete previous bills. */
  readonly endsOn?: ISODate
}

export interface SavingsGoal {
  readonly id: string
  readonly label: string
  readonly target: Paise
  /** Already outside the opening cash balance; never subtracted from it again. */
  readonly openingSaved: Paise
  readonly targetDate: ISODate
}

export interface SavingsTransfer {
  readonly id: string
  readonly goalId: string
  readonly amount: Paise
  readonly direction: 'deposit' | 'withdrawal'
  readonly date: ISODate
}

export interface FinancialPlan {
  readonly startDate: ISODate
  readonly openingCash: Paise
  readonly horizonDays: number
  readonly incomes: readonly Income[]
  readonly expenses: readonly Expense[]
  readonly commitments: readonly Commitment[]
  readonly subscriptions: readonly Subscription[]
  readonly savingsGoals: readonly SavingsGoal[]
  readonly savingsTransfers: readonly SavingsTransfer[]
}

/** A new 30-day plan begins with ₹10,000 cash, not a second income record. */
export function createPlan(startDate: ISODate): FinancialPlan {
  return {
    startDate: isoDate(startDate), openingCash: INITIAL_BUDGET, horizonDays: HORIZON_DAYS,
    incomes: [], expenses: [], commitments: [], subscriptions: [], savingsGoals: [], savingsTransfers: [],
  }
}

export function initialSnapshotDate(plan: FinancialPlan): ISODate {
  return addDays(plan.startDate, -1)
}

export interface OutstandingObligation {
  readonly reference: ObligationReference
  readonly label: string
  readonly dueDate: ISODate
  readonly amount: Paise
  readonly paid: Paise
  readonly remaining: Paise
  readonly overdue: boolean
}

export interface SavingsProgress {
  readonly goalId: string
  readonly saved: Paise
  readonly remaining: Paise
  readonly reserved: Paise
  readonly targetDate: ISODate
}

export interface ForecastDay {
  readonly date: ISODate
  readonly expectedIncome: Paise
  readonly obligationPayments: Paise
  readonly savingsFunding: Paise
  readonly discretionarySpending: Paise
  readonly closingCash: Paise
}

export type HealthCode = 'negative-cash' | 'forecast-shortfall' | 'reserves-underfunded'
  | 'overdue-obligation' | 'overdue-income' | 'savings-deadline-missed'
  | 'depends-on-planned-income' | 'on-track'

export interface HealthReason {
  readonly code: HealthCode
  readonly message: string
  readonly amount: Paise
}

export interface FinancialSnapshot {
  readonly asOf: ISODate
  readonly endDate: ISODate
  readonly daysElapsed: number
  readonly daysRemaining: number
  readonly receivedIncome: Paise
  readonly expectedIncome: Paise
  readonly overdueIncome: Paise
  readonly expensesPaid: Paise
  readonly netSavingsDeposits: Paise
  readonly cashBalance: Paise
  readonly savedTotal: Paise
  readonly obligations: readonly OutstandingObligation[]
  readonly savings: readonly SavingsProgress[]
  readonly obligationReserve: Paise
  readonly savingsReserve: Paise
  readonly spendableCash: Paise
  /** Safe allowance uses confirmed cash only, after all in-horizon reserves. */
  readonly dailyAllowance: Paise
  /** Scenario allowance includes unconfirmed future income. */
  readonly projectedDailyAllowance: Paise
  readonly forecast: {
    readonly observedDiscretionarySpending: Paise
    readonly observedDays: number
    readonly projectedDiscretionarySpending: Paise
    readonly closingCash: Paise
    readonly closingCashWithoutPlannedIncome: Paise
    readonly lowestCash: Paise
    readonly firstShortfallDate: ISODate | null
    readonly days: readonly ForecastDay[]
  }
  readonly health: { readonly state: 'healthy' | 'caution' | 'critical'; readonly reasons: readonly HealthReason[] }
}
