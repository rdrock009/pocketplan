import type { FinancialSnapshot, ISODate, Paise } from '../finance'
import { calculateFinancials } from '../finance'
import { monthReducer } from '../month/state'
import type { MonthAction, MonthState } from '../month/state'

interface ScenarioIdentity { readonly id: string }
interface TransactionScenario extends ScenarioIdentity {
  readonly label: string
  readonly amount: Paise
  readonly date: ISODate
}

export type Scenario =
  | (TransactionScenario & { readonly kind: 'purchase' | 'emergency' })
  | (TransactionScenario & { readonly kind: 'income'; readonly status: 'received' | 'planned' })
  | (ScenarioIdentity & { readonly kind: 'cancel-subscription'; readonly subscriptionId: string })
  | (ScenarioIdentity & { readonly kind: 'savings-target'; readonly goalId: string; readonly target: Paise; readonly targetDate: ISODate })

export interface ScenarioPreview {
  readonly scenario: Scenario
  readonly baseRevision: number
  readonly proposed: MonthState
}

/** The scenario ID is also the stable transaction identity, independent of click count. */
export function scenarioAction(scenario: Scenario): MonthAction {
  if (!scenario.id.trim()) throw new RangeError('Scenario ID must not be empty.')
  switch (scenario.kind) {
    case 'purchase':
    case 'emergency':
      if (!scenario.label.trim()) throw new RangeError('Name your purchase or emergency cost.')
      return { type: 'add-expense', item: { id: `what-if:${scenario.id}`, label: scenario.label, amount: scenario.amount, date: scenario.date, forecastTreatment: 'one-off' } }
    case 'income':
      if (!scenario.label.trim()) throw new RangeError('Name your extra income.')
      return { type: 'add-income', item: { id: `what-if:${scenario.id}`, label: scenario.label, amount: scenario.amount, date: scenario.date, status: scenario.status } }
    case 'cancel-subscription': return { type: 'cancel-subscription', id: scenario.subscriptionId }
    case 'savings-target': return { type: 'set-savings-target', id: scenario.goalId, target: scenario.target, targetDate: scenario.targetDate }
  }
}

/** Build a validated proposal through the same path as normal month edits, without mutation. */
export function proposeScenario(month: MonthState, scenario: Scenario): MonthState {
  const proposed = monthReducer(month, scenarioAction(scenario))
  if (proposed.error) throw new RangeError(proposed.error)
  return proposed
}

export function compareScenario(month: MonthState, preview: ScenarioPreview | null): { current: FinancialSnapshot; proposed: FinancialSnapshot | null } {
  return {
    current: calculateFinancials(month.plan, month.asOf),
    proposed: preview ? calculateFinancials(preview.proposed.plan, preview.proposed.asOf) : null,
  }
}

export function scenarioTitle(month: MonthState, scenario: Scenario): string {
  switch (scenario.kind) {
    case 'purchase': return `Purchase: ${scenario.label}`
    case 'emergency': return `Emergency cost: ${scenario.label}`
    case 'income': return `Extra income: ${scenario.label}`
    case 'cancel-subscription': return `Stop renewals: ${month.plan.subscriptions.find(item => item.id === scenario.subscriptionId)?.label ?? 'Subscription'}`
    case 'savings-target': return `Change target: ${month.plan.savingsGoals.find(item => item.id === scenario.goalId)?.label ?? 'Savings goal'}`
  }
}
