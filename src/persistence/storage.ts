import { calculateFinancials, isoDate, paise } from '../finance'
import type { FinancialPlan } from '../finance'
import type { MonthState } from '../month/state'
import { initialWorkspaceState } from '../whatif/state'
import type { WorkspaceState } from '../whatif/state'

export const STORAGE_KEY = 'budget-lab:workspace'
export const BACKUP_KEY = 'budget-lab:workspace:backup'
export const RECOVERY_KEY = 'budget-lab:workspace:recovery'
export const STORAGE_VERSION = 1
const MAX_BYTES = 2_000_000

export interface LocalStore { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface LoadResult { readonly workspace: WorkspaceState; readonly message: string; readonly needsRecoveryDecision: boolean }
export interface SaveResult { readonly saved: boolean; readonly message: string }

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Expected an object.')
  return value as Record<string, unknown>
}
function text(value: unknown, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('Invalid text.')
  return value
}
function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error('Invalid integer.')
  return value
}
function amount(value: unknown) { return paise(integer(value)) }
function date(value: unknown) { return isoDate(text(value, 10)) }
function array(value: unknown, limit = 2_000): unknown[] {
  if (!Array.isArray(value) || value.length > limit) throw new Error('Invalid collection.')
  return value as unknown[]
}
function choice<T extends string>(value: unknown, values: readonly T[]): T {
  for (const candidate of values) if (value === candidate) return candidate
  throw new Error('Invalid choice.')
}
function parseMonth(value: unknown): MonthState {
  const month = object(value)
  const p = object(month.plan)
  const identity = (value: unknown) => { const item = object(value); return { id: text(item.id), label: text(item.label, 100) } }
  const plan: FinancialPlan = {
    startDate: date(p.startDate), openingCash: amount(p.openingCash), horizonDays: integer(p.horizonDays),
    incomes: array(p.incomes).map(value => { const item = object(value); return { ...identity(item), amount: amount(item.amount), date: date(item.date), status: choice(item.status, ['received', 'planned']) } }),
    expenses: array(p.expenses).map(value => {
      const item = object(value)
      const ref = item.obligation === undefined ? undefined : object(item.obligation)
      const obligation = ref === undefined ? undefined : ref.kind === 'commitment'
        ? { kind: 'commitment' as const, commitmentId: text(ref.commitmentId) }
        : { kind: choice(ref.kind, ['subscription']), subscriptionId: text(ref.subscriptionId), dueDate: date(ref.dueDate) }
      return { ...identity(item), amount: amount(item.amount), date: date(item.date), ...(obligation ? { obligation } : {}), ...(item.forecastTreatment === undefined ? {} : { forecastTreatment: choice(item.forecastTreatment, ['pace', 'one-off']) }) }
    }),
    commitments: array(p.commitments).map(value => { const item = object(value); return { ...identity(item), amount: amount(item.amount), dueDate: date(item.dueDate) } }),
    subscriptions: array(p.subscriptions).map(value => {
      const item = object(value); const recurrence = object(item.recurrence)
      return { ...identity(item), amount: amount(item.amount), firstDueDate: date(item.firstDueDate), ...(item.endsOn === undefined ? {} : { endsOn: date(item.endsOn) }), recurrence: recurrence.kind === 'monthly' ? { kind: 'monthly' as const } : { kind: choice(recurrence.kind, ['every-days']), intervalDays: integer(recurrence.intervalDays) } }
    }),
    savingsGoals: array(p.savingsGoals).map(value => { const item = object(value); return { ...identity(item), target: amount(item.target), openingSaved: amount(item.openingSaved), targetDate: date(item.targetDate) } }),
    savingsTransfers: array(p.savingsTransfers).map(value => { const item = object(value); return { id: text(item.id), goalId: text(item.goalId), amount: amount(item.amount), date: date(item.date), direction: choice(item.direction, ['deposit', 'withdrawal']) } }),
  }
  const asOf = date(month.asOf)
  calculateFinancials(plan, asOf) // References, unique IDs, date ranges, overflow, and accounting invariants.
  return { plan, asOf, source: choice(month.source, ['sample', 'personal']), error: null, notice: 'Saved month restored from this device.' }
}

/** Reconstruct known fields from unknown JSON, then validate each financial snapshot. */
export function decodeWorkspace(raw: string): WorkspaceState {
  if (raw.length > MAX_BYTES) throw new Error('Saved data is too large.')
  const envelope = object(JSON.parse(raw) as unknown)
  if (envelope.version !== STORAGE_VERSION) throw new Error('Unsupported saved version.')
  const value = object(envelope.workspace)
  const revision = integer(value.revision)
  if (revision < 0) throw new Error('Invalid revision.')
  const consumedScenarioIds = array(value.consumedScenarioIds, 10_000).map(value => text(value))
  if (new Set(consumedScenarioIds).size !== consumedScenarioIds.length) throw new Error('Duplicate decision IDs.')
  const undoStack = array(value.undoStack, 50).map(value => { const entry = object(value); return { before: parseMonth(entry.before), title: text(entry.title) } })
  if (undoStack.length > consumedScenarioIds.length || undoStack.length > revision) throw new Error('Invalid Undo history.')
  return { month: parseMonth(value.month), revision, consumedScenarioIds, undoStack, preview: null, feedback: '', error: null }
}

export function encodeWorkspace(state: WorkspaceState): string {
  const durableMonth = (month: MonthState) => ({ plan: month.plan, asOf: month.asOf, source: month.source })
  const raw = JSON.stringify({ version: STORAGE_VERSION, workspace: {
    month: durableMonth(state.month), revision: state.revision, consumedScenarioIds: state.consumedScenarioIds,
    undoStack: state.undoStack.map(entry => ({ before: durableMonth(entry.before), title: entry.title })),
  } })
  decodeWorkspace(raw) // Never save a payload that this version cannot safely load.
  return raw
}

function browserStorage(): LocalStore { return window.localStorage }
export function loadWorkspace(storage?: LocalStore): LoadResult {
  const fallback = initialWorkspaceState()
  try {
    const store = storage ?? browserStorage()
    const primary = store.getItem(STORAGE_KEY)
    if (primary !== null) {
      try { return { workspace: decodeWorkspace(primary), message: '', needsRecoveryDecision: false } } catch { /* Try the last valid copy. */ }
    }
    const backup = store.getItem(BACKUP_KEY)
    if (backup !== null) {
      try { return { workspace: decodeWorkspace(backup), message: 'Saved data could not be loaded. Recovered the last valid backup; the latest change may be missing.', needsRecoveryDecision: false } } catch { /* A clean sample still works. */ }
    }
    return { workspace: fallback, message: primary !== null || backup !== null ? 'Saved data is damaged or uses an unsupported version. A sample month was loaded so you can continue. Start fresh or Reset sample to replace saved data.' : '', needsRecoveryDecision: primary !== null || backup !== null }
  } catch {
    return { workspace: fallback, message: 'Device storage is unavailable. You can still use the app without an account; changes may be lost on refresh.', needsRecoveryDecision: false }
  }
}

/** Keep a second valid copy of the latest save. Preserve damaged primary bytes when possible. */
export function saveWorkspace(state: WorkspaceState, storage?: LocalStore): SaveResult {
  try {
    const store = storage ?? browserStorage()
    const raw = encodeWorkspace(state)
    const existing = store.getItem(STORAGE_KEY)
    if (existing !== null && existing !== raw) {
      let valid = false
      try { decodeWorkspace(existing); valid = true } catch { /* Preserve damaged or newer-version data. */ }
      if (!valid) store.setItem(RECOVERY_KEY, existing)
    }
    if (existing !== raw) store.setItem(STORAGE_KEY, raw)
    if (store.getItem(BACKUP_KEY) !== raw) store.setItem(BACKUP_KEY, raw)
    return { saved: true, message: 'Saved on this device. No login or external service needed.' }
  } catch {
    return { saved: false, message: 'Could not save on this device. The app still works in this tab; changes may be lost on refresh.' }
  }
}
