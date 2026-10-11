import { describe, expect, it } from 'vitest'
import { calculateFinancials, isoDate, rupees } from '../finance'
import { initialWorkspaceState, workspaceReducer } from '../whatif/state'
import { BACKUP_KEY, decodeWorkspace, encodeWorkspace, loadWorkspace, RECOVERY_KEY, saveWorkspace, STORAGE_KEY, STORAGE_VERSION } from './storage'
import type { LocalStore } from './storage'

function memoryStore(): LocalStore {
  const values = new Map<string, string>()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } }
}
function applied() {
  const initial = initialWorkspaceState()
  const preview = workspaceReducer(initial, { type: 'preview', scenario: { id: 'buy', kind: 'purchase', label: 'Headphones', amount: rupees('500'), date: isoDate('2026-10-07') } })
  return workspaceReducer(preview, { type: 'apply', scenarioId: 'buy' })
}
const raw = (workspace: unknown, version = STORAGE_VERSION) => JSON.stringify({ version, workspace })

describe('versioned local persistence', () => {
  it('starts with a functional sample when nothing is saved', () => {
    const loaded = loadWorkspace(memoryStore())
    expect(loaded.workspace.month.plan).toEqual(initialWorkspaceState().month.plan)
    expect(loaded.message).toBe('')
    expect(loaded.needsRecoveryDecision).toBe(false)
  })
  it('round-trips every financial collection, exact paise, snapshot, Undo and decision IDs', () => {
    const state = applied(), store = memoryStore()
    expect(saveWorkspace(state, store).saved).toBe(true)
    expect(JSON.parse(store.getItem(STORAGE_KEY)!) as unknown).toMatchObject({ version: 1 })
    const loaded = loadWorkspace(store).workspace
    expect(loaded.month.plan).toEqual(state.month.plan)
    expect(loaded.month.asOf).toBe(state.month.asOf)
    expect(loaded.undoStack[0]?.before.plan).toEqual(initialWorkspaceState().month.plan)
    expect(loaded.consumedScenarioIds).toEqual(['buy'])
    expect(workspaceReducer(loaded, { type: 'apply', scenarioId: 'buy' }).month).toBe(loaded.month)
    expect(workspaceReducer(loaded, { type: 'undo' }).month.plan).toEqual(initialWorkspaceState().month.plan)
  })
  it('does not persist uncommitted previews, notices or validation errors', () => {
    const state = workspaceReducer(initialWorkspaceState(), { type: 'preview', scenario: { id: 'draft', kind: 'emergency', label: 'Never save this preview', amount: rupees('500'), date: isoDate('2026-10-07') } })
    const encoded = encodeWorkspace({ ...state, error: 'Temporary error', month: { ...state.month, error: 'Other error', notice: 'Temporary notice' } })
    expect(encoded).not.toContain('Never save this preview')
    expect(encoded).not.toContain('Temporary')
    const loaded = decodeWorkspace(encoded)
    expect(loaded.preview).toBeNull()
    expect(loaded.error).toBeNull()
    expect(loaded.month.error).toBeNull()
  })
  it.each(['not json', 'null', '{}', raw(initialWorkspaceState(), 0), raw(initialWorkspaceState(), 999)])('recovers gracefully from invalid JSON or unsupported versions: %s', broken => {
    const store = memoryStore(); store.setItem(STORAGE_KEY, broken)
    const loaded = loadWorkspace(store)
    expect(loaded.workspace.month.plan).toEqual(initialWorkspaceState().month.plan)
    expect(loaded.message).toMatch(/damaged|unsupported/)
    expect(loaded.needsRecoveryDecision).toBe(true)
    expect(store.getItem(STORAGE_KEY)).toBe(broken)
  })
  it('recovers the latest valid backup and preserves corrupt bytes on the next save', () => {
    const store = memoryStore(); saveWorkspace(applied(), store)
    store.setItem(STORAGE_KEY, 'corrupted')
    const loaded = loadWorkspace(store)
    expect(loaded.message).toMatch(/backup/)
    expect(loaded.workspace.month.plan).toEqual(applied().month.plan)
    expect(saveWorkspace(loaded.workspace, store).saved).toBe(true)
    expect(store.getItem(RECOVERY_KEY)).toBe('corrupted')
    expect(decodeWorkspace(store.getItem(STORAGE_KEY)!).month.plan).toEqual(applied().month.plan)
  })
  it('falls back when both copies are bad and can replace them with a fresh month', () => {
    const store = memoryStore(); store.setItem(STORAGE_KEY, 'broken'); store.setItem(BACKUP_KEY, 'broken backup')
    const loaded = loadWorkspace(store)
    expect(loaded.needsRecoveryDecision).toBe(true)
    const fresh = workspaceReducer(loaded.workspace, { type: 'month', action: { type: 'start-fresh', startDate: isoDate('2026-11-01') } })
    saveWorkspace(fresh, store)
    expect(loadWorkspace(store).workspace.month.source).toBe('personal')
    expect(loadWorkspace(store).workspace.month.plan.expenses).toHaveLength(0)
    store.setItem(STORAGE_KEY, 'broken again')
    expect(loadWorkspace(store).workspace.month.plan.startDate).toBe('2026-11-01')
  })
  it.each(['reset-sample', 'start-fresh'] as const)('persists %s and replaces the backup so old edits cannot return', type => {
    const store = memoryStore(); saveWorkspace(applied(), store)
    const reset = workspaceReducer(applied(), { type: 'month', action: type === 'reset-sample' ? { type } : { type, startDate: isoDate('2026-11-01') } })
    expect(saveWorkspace(reset, store).saved).toBe(true)
    const loaded = loadWorkspace(store).workspace
    expect(loaded.month.plan).toEqual(reset.month.plan)
    expect(loaded.undoStack).toHaveLength(0)
    expect(loaded.preview).toBeNull()
    expect(loaded.consumedScenarioIds).toContain('buy')
    expect(decodeWorkspace(store.getItem(BACKUP_KEY)!).month.plan).toEqual(reset.month.plan)
  })
  it('handles denied reads and quota/write failures without throwing or mutating the month', () => {
    const denied: LocalStore = { getItem: () => { throw new Error('Denied') }, setItem: () => { throw new Error('Denied') } }
    expect(loadWorkspace(denied).message).toMatch(/unavailable/)
    const state = applied()
    expect(saveWorkspace(state, denied).saved).toBe(false)
    const quota: LocalStore = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError') } }
    expect(saveWorkspace(state, quota).message).toMatch(/still works/)
    expect(state.month.plan.expenses).toHaveLength(5)
  })
  it('does not rewrite identical data on repeated saves', () => {
    const memory = memoryStore(); let writes = 0
    const store: LocalStore = { getItem: key => memory.getItem(key), setItem: (key, value) => { writes++; memory.setItem(key, value) } }
    saveWorkspace(applied(), store); const before = writes
    saveWorkspace(applied(), store)
    expect(writes).toBe(before)
  })
  it('recomputes engine values on load rather than trusting cached display values', () => {
    const state = applied()
    const loaded = decodeWorkspace(raw({ ...state, cashBalance: 9_999_999, month: { ...state.month, cashBalance: 9_999_999 } }))
    expect(calculateFinancials(loaded.month.plan, loaded.month.asOf).cashBalance).toBe(rupees('9450'))
  })
  it.each([
    { ...initialWorkspaceState(), revision: -1 },
    { ...initialWorkspaceState(), consumedScenarioIds: ['a', 'a'] },
    { ...initialWorkspaceState(), undoStack: [{ before: initialWorkspaceState().month, title: 'Forged' }] },
    { ...initialWorkspaceState(), month: { ...initialWorkspaceState().month, source: 'unknown' } },
    { ...initialWorkspaceState(), month: { ...initialWorkspaceState().month, asOf: '2026-02-30' } },
    { ...initialWorkspaceState(), month: { ...initialWorkspaceState().month, plan: { ...initialWorkspaceState().month.plan, expenses: 'wrong shape' } } },
    { ...initialWorkspaceState(), month: { ...initialWorkspaceState().month, plan: { ...initialWorkspaceState().month.plan, openingCash: 1.5 } } },
    { ...initialWorkspaceState(), month: { ...initialWorkspaceState().month, plan: { ...initialWorkspaceState().month.plan, incomes: [{ id: 'x', label: null, amount: 100, status: 'received', date: '2026-10-07' }] } } },
  ])('rejects malformed storage shapes and values: %j', value => {
    expect(() => decodeWorkspace(raw(value))).toThrow()
  })
  it('rejects invalid linked payments and invalid Undo snapshots', () => {
    const state = applied()
    const badPlan = { ...state.month.plan, expenses: [{ id: 'bad', label: 'Bad payment', amount: 100, date: '2026-10-07', obligation: { kind: 'commitment', commitmentId: 'missing' } }] }
    expect(() => decodeWorkspace(raw({ ...state, month: { ...state.month, plan: badPlan } }))).toThrow(/unknown commitment/)
    expect(() => decodeWorkspace(raw({ ...state, undoStack: [{ title: 'Bad', before: { ...state.month, plan: badPlan } }] }))).toThrow()
  })
  it('rejects oversized saved data before attempting to parse it', () => {
    expect(() => decodeWorkspace(' '.repeat(2_000_001))).toThrow(/too large/)
  })
})
