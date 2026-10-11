import { addDays, createPlan, isoDate, paise, rupees } from '../finance'
import type { FinancialPlan } from '../finance'

export const SAMPLE_START = isoDate('2026-10-01')
export const SAMPLE_AS_OF = addDays(SAMPLE_START, 6)

export function samplePlan(): FinancialPlan {
  return {
    ...createPlan(SAMPLE_START),
    incomes: [
      { id: 'sample-tutoring', label: 'Tutoring', amount: rupees('1500'), date: addDays(SAMPLE_START, 2), status: 'received' },
      { id: 'sample-freelance', label: 'Freelance project', amount: rupees('2000'), date: addDays(SAMPLE_START, 19), status: 'planned' },
    ],
    expenses: [
      { id: 'sample-lunch', label: 'Lunch with friends', amount: rupees('150'), date: SAMPLE_START },
      { id: 'sample-travel', label: 'Metro & bus', amount: rupees('200'), date: addDays(SAMPLE_START, 2) },
      { id: 'sample-groceries', label: 'Groceries', amount: rupees('400'), date: addDays(SAMPLE_START, 4) },
      { id: 'sample-repair', label: 'Unexpected charger replacement', amount: rupees('300'), date: SAMPLE_AS_OF },
    ],
    commitments: [{ id: 'sample-rent', label: 'Room rent', amount: rupees('3500'), dueDate: addDays(SAMPLE_START, 9) }],
    subscriptions: [{ id: 'sample-music', label: 'Music membership', amount: rupees('199'), firstDueDate: addDays(SAMPLE_START, 14), recurrence: { kind: 'monthly' } }],
    savingsGoals: [{ id: 'sample-buffer', label: 'Emergency buffer', target: rupees('1500'), openingSaved: paise(0), targetDate: addDays(SAMPLE_START, 29) }],
    savingsTransfers: [{ id: 'sample-save', goalId: 'sample-buffer', amount: rupees('500'), direction: 'deposit', date: addDays(SAMPLE_START, 5) }],
  }
}
