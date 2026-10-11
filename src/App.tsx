import { useMemo, useState } from 'react'
import { calculateFinancials, initialSnapshotDate, isoDate } from './finance'
import type { EntryKind } from './month/entries'
import { entryNames } from './month/entries'
import { dateLabel, money } from './month/format'
import { EntryForm } from './month/EntryForm'
import { Records, UpcomingBills } from './month/Records'
import { monthReducer, SAMPLE_START } from './month/state'
import type { MonthAction } from './month/state'
import { useLocalWorkspace } from './persistence/useLocalWorkspace'
import { useTheme } from './hooks'
import { Amount, ForecastChart, Header, OverviewSection } from './components'
import { WhatIf } from './whatif/WhatIf'

const entryKinds: EntryKind[] = ['income', 'expense', 'commitment', 'subscription', 'savings']

export default function App() {
  const { workspace, dispatch, saveStatus, recoveryMessage } = useLocalWorkspace()
  const state = workspace.month
  const [surface, setSurface] = useState<'month' | 'what-if'>('month')
  const [kind, setKind] = useState<EntryKind>('expense')
  const [freshStart, setFreshStart] = useState<string>(SAMPLE_START)
  const [editorEpoch, setEditorEpoch] = useState(0)
  const { effectiveTheme, setTheme } = useTheme()

  /** Memoize the expensive financial calculation */
  const snapshot = useMemo(
    () => calculateFinancials(state.plan, state.asOf),
    [state.plan, state.asOf]
  )

  const healthLabel = useMemo(
    () => ({ healthy: 'On track', caution: 'Needs attention', critical: 'Shortfall risk' }[snapshot.health.state]),
    [snapshot.health.state]
  )

  const counts: Record<EntryKind, number> = useMemo(() => ({
    income: state.plan.incomes.length,
    expense: state.plan.expenses.length,
    commitment: state.plan.commitments.length,
    subscription: state.plan.subscriptions.length,
    savings: state.plan.savingsGoals.length,
  }), [state.plan])

  function commit(action: MonthAction): boolean {
    const valid = monthReducer(state, action).error === null
    dispatch({ type: 'month', action })
    if (valid && (action.type === 'reset-sample' || action.type === 'start-fresh')) {
      setEditorEpoch(value => value + 1)
      if (action.type === 'reset-sample') setFreshStart(SAMPLE_START)
    }
    return valid
  }

  const handleExport = () => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(workspace, null, 2))
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute('href', dataStr)
      downloadAnchor.setAttribute('download', `pocketplan-backup-${workspace.month.plan.startDate}.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
    } catch {
      /* ignore */
    }
  }

  return <>
    <a className="skip-link" href="#main">Skip to main content</a>
    <Header
      surface={surface}
      setSurface={setSurface}
      effectiveTheme={effectiveTheme}
      setTheme={setTheme}
      onExport={handleExport}
    />

    <main id="main" className="page" tabIndex={-1}>
      <div className="page-heading">
        <div>
          <h1>{surface === 'month' ? 'My Month' : 'What If'}</h1>
          <p>{dateLabel(state.plan.startDate)} – {dateLabel(snapshot.endDate)} {snapshot.endDate.slice(0, 4)} · {money(state.plan.openingCash)} starting budget</p>
        </div>
        <form className="snapshot-control" key={state.asOf} onSubmit={event => { event.preventDefault(); const value = new FormData(event.currentTarget).get('snapshot'); if (typeof value === 'string' && value) commit({ type: 'snapshot', date: isoDate(value) }) }}>
          <label htmlFor="snapshot-day">Snapshot day</label>
          <div className="snapshot-input">
            <input id="snapshot-day" name="snapshot" aria-describedby="snapshot-help" type="date" defaultValue={state.asOf} min={initialSnapshotDate(state.plan)} max={snapshot.endDate} required />
            <button className="button small" type="submit" aria-label="Apply snapshot day">Apply</button>
          </div>
          <span id="snapshot-help" className="fine-print">End-of-day view</span>
        </form>
      </div>

      <div className={`mode-banner ${state.source === 'sample' ? 'sample-mode' : ''}`}>
        <div>
          <strong>{state.source === 'sample' ? 'Sample data · fictional month' : 'Your fresh month'}</strong>
          <p>{state.source === 'sample' ? 'Try the controls below. These are example entries, not your actual finances.' : 'Your entries start from a clean ₹10,000 budget.'} Your month is saved in this browser on this device. Preview drafts are never saved.</p>
        </div>
        <div className="reset-controls">
          <label>New month start<input type="date" required value={freshStart} onChange={event => setFreshStart(event.target.value)} /></label>
          <button type="button" className="button" disabled={!freshStart} onClick={() => commit({ type: 'start-fresh', startDate: isoDate(freshStart) })}>Start fresh</button>
          <button type="button" className="text-button" onClick={() => commit({ type: 'reset-sample' })}>Reset sample</button>
        </div>
      </div>

      <p className="fine-print persistence-status" role="status" data-testid="save-status">{saveStatus.message}</p>
      {recoveryMessage && <p className="form-error" role="status">{recoveryMessage}</p>}
      <div className="feedback" hidden={surface !== 'month'} aria-live="polite" role="status">{state.notice}</div>
      {state.error && <p className="form-error shared-error" role="alert">{state.error}</p>}

      <div id="month-view" hidden={surface !== 'month'}>
        <OverviewSection snapshot={snapshot} state={state} healthLabel={healthLabel} />

        <section className="forecast-section" aria-labelledby="forecast-title">
          <div className="forecast-heading">
            <div>
              <h2 id="forecast-title">Where this month is heading</h2>
              <p>Daily closing cash after outstanding bills, savings funding, and your observed spending pace.</p>
            </div>
            <div className="forecast-total">
              <span>Forecast closing cash</span>
              <Amount value={snapshot.forecast.closingCash} id="forecast-closing" />
            </div>
          </div>

          {/* Forecast visualization chart */}
          {snapshot.forecast.days.length >= 2 && <ForecastChart days={snapshot.forecast.days} />}

          <dl className="forecast-facts">
            <div><dt>Planned income included</dt><dd><Amount value={snapshot.expectedIncome} id="expected-income" /></dd></div>
            <div><dt>Closing cash without it</dt><dd><Amount value={snapshot.forecast.closingCashWithoutPlannedIncome} id="forecast-without-income" /></dd></div>
            <div><dt>First forecast shortfall</dt><dd data-testid="first-shortfall">{snapshot.forecast.firstShortfallDate ? dateLabel(snapshot.forecast.firstShortfallDate) : 'None projected'}</dd></div>
            <div><dt>Total already saved</dt><dd><Amount value={snapshot.savedTotal} id="saved-total" /></dd></div>
          </dl>
          <details className="forecast-details"><summary>See forecast assumptions and daily balances</summary>
            <p className="fine-print">Planned income is unconfirmed. Your projected allowance including it is {money(snapshot.projectedDailyAllowance)} per day. Unlinked expenses are averaged over {snapshot.daysElapsed} elapsed days, excluding costs explicitly marked as one-off. With no history, future discretionary spending is assumed to be zero. Overdue bills and missed savings targets are scheduled on the next remaining day. Intraday cash timing is not modelled.</p>
            {snapshot.forecast.days.length > 0 ? (
              <div className="table-scroll" tabIndex={0} role="region" aria-label="Daily forecast">
                <table><caption>Daily forecast · all amounts in INR</caption>
                  <thead><tr><th scope="col">Date</th><th scope="col">Income</th><th scope="col">Bills</th><th scope="col">Savings</th><th scope="col">Spending</th><th scope="col">Closing cash</th></tr></thead>
                  <tbody>{snapshot.forecast.days.map(day => (
                    <tr key={day.date}><th scope="row">{dateLabel(day.date)}</th><td>{money(day.expectedIncome)}</td><td>{money(day.obligationPayments)}</td><td>{money(day.savingsFunding)}</td><td>{money(day.discretionarySpending)}</td><td className={day.closingCash < 0 ? 'negative' : ''}>{money(day.closingCash)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="empty-state">No days remain to forecast. Outstanding reserves are included in the closing settlement scenario.</p>}
          </details>
        </section>

        <UpcomingBills state={state} onAction={commit} />

        <section className="manage-section" aria-labelledby="manage-title">
          <div className="section-heading">
            <h2 id="manage-title">Make this month yours</h2>
            <span>Add, settle, or remove an entry</span>
          </div>
          <nav className="entry-navigation" aria-label="Entry types">
            {entryKinds.map(value => (
              <button type="button" key={value} aria-pressed={kind === value} onClick={() => setKind(value)}>
                {entryNames[value]}<span>{counts[value]}</span>
              </button>
            ))}
          </nav>
          <div className="manage-grid">
            <EntryForm key={`${kind}-${editorEpoch}-${state.asOf}`} kind={kind} state={state} onAction={commit} />
            <Records kind={kind} state={state} snapshot={snapshot} onAction={commit} />
          </div>
        </section>
      </div>

      <div id="whatif-view" hidden={surface !== 'what-if'}>
        <WhatIf state={workspace} onAction={dispatch} />
      </div>

      <footer className="page-footer">
        <p>Every number comes from the same month. Payments are counted once.</p>
        <a href="#main">Back to top</a>
      </footer>
    </main>
  </>
}
