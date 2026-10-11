export type EntryKind = 'income' | 'expense' | 'commitment' | 'subscription' | 'savings'

export const entryNames: Record<EntryKind, string> = {
  income: 'Income', expense: 'Expenses', commitment: 'Commitments', subscription: 'Subscriptions', savings: 'Savings',
}
