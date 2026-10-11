import { useEffect, useReducer, useState } from 'react'
import { workspaceReducer } from '../whatif/state'
import { loadWorkspace, saveWorkspace } from './storage'
import type { SaveResult } from './storage'

export function useLocalWorkspace() {
  const [loaded] = useState(loadWorkspace)
  const [workspace, dispatch] = useReducer(workspaceReducer, loaded.workspace)
  const [saveStatus, setSaveStatus] = useState<SaveResult>({ saved: false, message: loaded.needsRecoveryDecision ? 'Saved data was left untouched. Reset or make an edit to save a new month.' : 'Saving on this device…' })
  const { plan, asOf, source } = workspace.month
  const { revision, consumedScenarioIds, undoStack } = workspace
  // Draft previews and transient errors never cause a save. The microtask lets the
  // effect report storage I/O asynchronously and avoids duplicate StrictMode writes.
  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => {
      if (!active || (loaded.needsRecoveryDecision && revision === loaded.workspace.revision)) return
      setSaveStatus(saveWorkspace({ month: { plan, asOf, source, error: null, notice: '' }, revision, consumedScenarioIds, undoStack, preview: null, feedback: '', error: null }))
    })
    return () => { active = false }
  }, [plan, asOf, source, revision, consumedScenarioIds, undoStack, loaded])
  return { workspace, dispatch, saveStatus, recoveryMessage: revision === loaded.workspace.revision ? loaded.message : '' }
}
