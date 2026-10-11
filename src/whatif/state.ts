import { initialMonthState, monthReducer } from '../month/state'
import type { MonthAction, MonthState } from '../month/state'
import { proposeScenario, scenarioTitle } from './scenario'
import type { Scenario, ScenarioPreview } from './scenario'

interface UndoEntry {
  readonly before: MonthState
  readonly title: string
}

export interface WorkspaceState {
  readonly month: MonthState
  readonly revision: number
  readonly preview: ScenarioPreview | null
  readonly undoStack: readonly UndoEntry[]
  /** IDs stay consumed after Undo, so a delayed retry cannot reapply an undone decision. */
  readonly consumedScenarioIds: readonly string[]
  readonly feedback: string
  readonly error: string | null
}

export type WorkspaceAction =
  | { type: 'month'; action: MonthAction }
  | { type: 'preview'; scenario: Scenario }
  | { type: 'apply'; scenarioId: string }
  | { type: 'discard'; edited?: boolean }
  | { type: 'undo' }

export function initialWorkspaceState(): WorkspaceState {
  return { month: initialMonthState(), revision: 0, preview: null, undoStack: [], consumedScenarioIds: [], feedback: '', error: null }
}

/** Atomic reducer: draft previews, committed month, idempotency ledger, and undo move together. */
export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  try {
    switch (action.type) {
      case 'month': {
        const month = monthReducer(state.month, action.action)
        if (month.error) return { ...state, month }
        return {
          ...state, month, revision: state.revision + 1, preview: null, undoStack: [], error: null,
          feedback: state.preview || state.undoStack.length ? 'My Month changed. Preview and Undo were cleared so they cannot overwrite that edit.' : '',
        }
      }
      case 'preview': {
        if (state.consumedScenarioIds.includes(action.scenario.id)) throw new RangeError('This decision was already applied. Create a new preview for a new decision.')
        const proposed = proposeScenario(state.month, action.scenario)
        return { ...state, preview: { scenario: action.scenario, proposed, baseRevision: state.revision }, error: null, feedback: 'Preview ready. Your committed month is unchanged.' }
      }
      case 'discard':
        return { ...state, preview: null, error: null, feedback: action.edited ? 'The draft changed. Preview again before applying.' : 'Preview discarded. Your committed month is unchanged.' }
      case 'apply': {
        if (state.consumedScenarioIds.includes(action.scenarioId)) {
          return { ...state, error: null, feedback: 'This decision was already applied. No duplicate entry was created.' }
        }
        const preview = state.preview
        if (!preview || preview.scenario.id !== action.scenarioId) throw new RangeError('No matching preview is available. Preview your decision first.')
        if (preview.baseRevision !== state.revision) throw new RangeError('Your month changed after this preview. Preview again before applying.')
        // Revalidate on the live month; never blindly copy a previously calculated proposal.
        const proposed = proposeScenario(state.month, preview.scenario)
        const title = scenarioTitle(state.month, preview.scenario)
        return {
          ...state, month: { ...proposed, error: null, notice: `${title} applied once. All month values updated.` },
          revision: state.revision + 1, preview: null,
          consumedScenarioIds: [...state.consumedScenarioIds, action.scenarioId],
          undoStack: [...state.undoStack, { before: state.month, title }], error: null,
          feedback: 'Applied once. You can Undo this decision, or make a new preview.',
        }
      }
      case 'undo': {
        const entry = state.undoStack.at(-1)
        if (!entry) throw new RangeError('Nothing to undo. Undo is available after applying a What If decision, until My Month is edited.')
        return {
          ...state, month: { ...entry.before, error: null, notice: `${entry.title} undone. Your previous month was restored.` },
          revision: state.revision + 1, preview: null, undoStack: state.undoStack.slice(0, -1), error: null,
          feedback: 'Decision undone. Preview again to make a new decision.',
        }
      }
    }
  } catch (error) {
    return { ...state, preview: action.type === 'preview' ? null : state.preview, error: error instanceof Error ? error.message : 'Unable to preview this decision. Check the fields and try again.', feedback: '' }
  }
}
