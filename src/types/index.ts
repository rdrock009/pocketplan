export type { ISODate, Paise, FinancialPlan, FinancialSnapshot, Income, Expense, Commitment, Subscription, SavingsGoal, SavingsTransfer } from '../finance'
export type { EntryKind } from '../month/entries'
export type { MonthState, MonthAction } from '../month/state'
export type { Scenario, ScenarioPreview } from '../whatif/scenario'
export type { WorkspaceState } from '../whatif/state'
export type { LoadResult, SaveResult } from '../persistence/storage'

export interface AppConfig {
  name: string
  version: string
  defaultHorizonDays: number
  currencySymbol: string
}
