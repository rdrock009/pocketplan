import { useState } from 'react'
import type { FormEvent } from 'react'
import { isoDate, rupees } from '../finance'
import { dateLabel, decimalMoney, money, moneyChange } from '../month/format'
import { transactionDate } from '../month/state'
import { compareScenario, scenarioTitle } from './scenario'
import type { Scenario } from './scenario'
import type { Paise } from '../finance'
import type { WorkspaceAction, WorkspaceState } from './state'

const names = { purchase: 'Purchase', emergency: 'Emergency cost', income: 'Extra income', 'cancel-subscription': 'Cancel subscription', 'savings-target': 'Change savings target' }
const healthNames = { healthy: 'On track', caution: 'Needs attention', critical: 'Shortfall risk' }


interface ComparisonRow { label: string; key: string; before: Paise; after: Paise | undefined }
function ComparisonRows({ rows }: { rows: ComparisonRow[] }) {
  return rows.map(row => <tr key={row.key} className={row.key === 'daily' || row.key === 'closing' ? 'key-impact' : undefined}>
    <th scope="row">{row.label}</th>
    <td data-testid={`whatif-current-${row.key}`}>{money(row.before)}</td>
    <td className="proposed-value" data-testid={`whatif-proposed-${row.key}`}>{row.after === undefined ? <span aria-label="No preview yet">—</span> : money(row.after)}</td>
    <td className="delta-value" data-testid={`whatif-delta-${row.key}`}>{row.after === undefined ? <span aria-label="No preview yet">—</span> : moneyChange(row.before, row.after)}</td>
  </tr>)
}
function ComparisonHeader() {
  return <thead><tr><th scope="col">Measure</th><th scope="col">Current</th><th scope="col">Proposed</th><th scope="col">Change</th></tr></thead>
}

export function WhatIf({ state, onAction }: { state: WorkspaceState; onAction: (action: WorkspaceAction) => void }) {
  const [kind, setKind] = useState<Scenario['kind']>('purchase')
  const [goalId, setGoalId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { current, proposed } = compareScenario(state.month, state.preview)
  const goal = state.month.plan.savingsGoals.find(item => item.id === goalId) ?? state.month.plan.savingsGoals[0]
  const subscriptions = state.month.plan.subscriptions.filter(item => !item.endsOn || item.endsOn > state.month.asOf)
  const transaction = kind === 'purchase' || kind === 'emergency' || kind === 'income'
  const unavailable = (kind === 'savings-target' && !goal) || (kind === 'cancel-subscription' && !subscriptions.length)
  function edited() { setError(null); if (state.preview) onAction({ type: 'discard', edited: true }) }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const field = (key: string) => { const value = data.get(key); return typeof value === 'string' ? value.trim() : '' }
    try {
      const id = crypto.randomUUID()
      let scenario: Scenario
      if (kind === 'cancel-subscription') scenario = { id, kind, subscriptionId: field('subscription') }
      else if (kind === 'savings-target') scenario = { id, kind, goalId: goal?.id ?? '', target: rupees(field('target')), targetDate: isoDate(field('targetDate')) }
      else {
        const item = { id, label: field('label'), amount: rupees(field('amount')), date: isoDate(field('date')) }
        scenario = kind === 'income' ? { ...item, kind, status: field('status') === 'planned' ? 'planned' : 'received' } : { ...item, kind }
      }
      setError(null)
      onAction({ type: 'preview', scenario })
    } catch (failure) { edited(); setError(failure instanceof Error ? failure.message : 'Check the scenario fields.') }
  }
  const rows = [
    { label: 'Cash balance', key: 'cash', before: current.cashBalance, after: proposed?.cashBalance },
    { label: 'Free after reserves', key: 'free', before: current.spendableCash, after: proposed?.spendableCash },
    { label: 'Safe daily allowance', key: 'daily', before: current.dailyAllowance, after: proposed?.dailyAllowance },
    { label: 'Unpaid bill reserves', key: 'bills', before: current.obligationReserve, after: proposed?.obligationReserve },
    { label: 'Unfunded savings reserves', key: 'savings', before: current.savingsReserve, after: proposed?.savingsReserve },
    { label: 'Already saved', key: 'saved', before: current.savedTotal, after: proposed?.savedTotal },
    { label: 'Planned income included', key: 'income', before: current.expectedIncome, after: proposed?.expectedIncome },
    { label: 'Forecast closing cash', key: 'closing', before: current.forecast.closingCash, after: proposed?.forecast.closingCash },
    { label: 'Closing cash without planned income', key: 'without-income', before: current.forecast.closingCashWithoutPlannedIncome, after: proposed?.forecast.closingCashWithoutPlannedIncome },
  ]
  const primaryKeys = new Set(['cash', 'free', 'daily', 'closing'])
  const primaryRows = rows.filter(row => primaryKeys.has(row.key))
  const supportingRows = rows.filter(row => !primaryKeys.has(row.key))
  return <section aria-labelledby="whatif-title" className="whatif-section">
    <div className="section-heading"><div><h2 id="whatif-title">Try a decision before committing</h2><p className="muted">Compare your current month with one proposed change. Preview leaves My Month unchanged.</p></div></div>
    <div className="whatif-grid">
      <div className="entry-editor"><h3>Your decision</h3><form aria-describedby="scenario-guidance" onSubmit={submit} onChange={edited}>
        <label>Scenario type<select value={kind} onChange={event => { edited(); setKind(event.target.value as Scenario['kind']) }}>{Object.entries(names).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="form-grid" key={`${kind}-${state.month.plan.startDate}`}>
          {transaction && <><label className="wide">Scenario name<input name="label" required maxLength={100} placeholder={kind === 'emergency' ? 'e.g. Urgent repair' : kind === 'income' ? 'e.g. Extra tutoring' : 'e.g. New headphones'} /></label><label>Scenario amount (₹)<input name="amount" required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" maxLength={18} placeholder="0.00" /></label><label>Scenario date<input name="date" type="date" required min={state.month.plan.startDate} max={current.endDate} defaultValue={transactionDate(state.month)} /></label>{kind === 'income' && <label className="wide">Scenario income status<select name="status"><option value="received">Received — add to cash</option><option value="planned">Planned — forecast only</option></select></label>}</>}
          {kind === 'cancel-subscription' && <label className="wide">Subscription to cancel<select name="subscription" required disabled={unavailable}>{subscriptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
          {kind === 'savings-target' && <><label className="wide">Scenario savings goal<select value={goal?.id ?? ''} onChange={event => setGoalId(event.target.value)} disabled={unavailable}>{state.month.plan.savingsGoals.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><div className="target-fields wide form-grid" key={`${goal?.id}-${goal?.target}-${goal?.targetDate}`}><label>Proposed target (₹)<input name="target" required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" defaultValue={goal ? decimalMoney(goal.target) : '0'} /></label><label>Proposed target date<input name="targetDate" type="date" required defaultValue={goal?.targetDate ?? current.endDate} min={state.month.plan.startDate} /></label></div></>}
        </div>
        <p className="fine-print scenario-guidance" id="scenario-guidance">{kind === 'cancel-subscription' ? 'Stops future unpaid renewals. Past bills and payments remain counted.' : kind === 'savings-target' ? 'Changes the reserve and forecast funding. Money already saved stays saved; no transfer is created.' : kind === 'income' ? 'Planned income affects the forecast only. Received income changes cash.' : 'A one-off cost, counted once. It does not increase your recurring spending pace.'} {transaction && 'A later posted date advances the proposed snapshot.'}</p>
        {unavailable && <p className="empty-state">Add {kind === 'savings-target' ? 'a savings goal' : 'an active subscription'} in My Month first.</p>}
        {error && <p role="alert" className="form-error">{error}</p>}
        <button className="button primary" disabled={unavailable} type="submit">Preview decision</button>
      </form></div>
      <div className="comparison">
        <div className="comparison-heading"><h3>Current versus proposed</h3><span className="preview-badge">{state.preview ? 'Preview only' : 'Current month'}</span></div>
        <p className="comparison-context">{state.preview ? scenarioTitle(state.month, state.preview.scenario) : 'Preview a decision to see what changes.'}</p>
        <div className="table-scroll" role="region" aria-label="Scenario comparison" tabIndex={0}>
          <table aria-label="Main scenario impacts"><caption>All amounts in INR · proposed values are a preview</caption><ComparisonHeader /><tbody><ComparisonRows rows={primaryRows} /></tbody></table>
        </div>
        <div className="decision-actions">
          <button type="button" className="button primary" disabled={!state.preview} onClick={() => { if (state.preview) onAction({ type: 'apply', scenarioId: state.preview.scenario.id }) }}>Apply decision</button>
          <button type="button" className="button" disabled={!state.preview} onClick={() => onAction({ type: 'discard' })}>Discard preview</button>
          <button type="button" className="text-button" disabled={!state.undoStack.length} onClick={() => onAction({ type: 'undo' })}>Undo last decision</button>
        </div>
        <p className="fine-print decision-help">Apply commits once. Undo restores the previous month. Editing My Month clears Undo to protect later edits.</p>
        <div className="feedback" role="status" aria-live="polite">{state.feedback}</div>
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        <details className="comparison-details">
          <summary>More comparison details</summary>
          <div className="table-scroll" role="region" aria-label="Supporting scenario comparison" tabIndex={0}>
            <table aria-label="Supporting scenario impacts"><caption>Reserves, savings, income, and timing</caption><ComparisonHeader /><tbody>
              <ComparisonRows rows={supportingRows} />
              <tr><th scope="row">Snapshot day</th><td>{dateLabel(state.month.asOf)}</td><td>{state.preview ? dateLabel(state.preview.proposed.asOf) : '—'}</td><td>—</td></tr>
              <tr><th scope="row">Days remaining</th><td>{current.daysRemaining}</td><td>{proposed?.daysRemaining ?? '—'}</td><td>{proposed ? proposed.daysRemaining - current.daysRemaining : '—'}</td></tr>
              <tr><th scope="row">First forecast shortfall</th><td>{current.forecast.firstShortfallDate ? dateLabel(current.forecast.firstShortfallDate) : 'None projected'}</td><td>{proposed ? proposed.forecast.firstShortfallDate ? dateLabel(proposed.forecast.firstShortfallDate) : 'None projected' : '—'}</td><td>—</td></tr>
            </tbody></table>
          </div>
        </details>
      </div>
    </div>
    <div className="comparison-health">{[{ title: 'Current health', snapshot: current }, { title: 'Proposed health', snapshot: proposed }].map(item => <aside key={item.title} className={`health health-${item.snapshot?.health.state ?? 'healthy'}`}><h3>{item.title}</h3>{item.snapshot ? <><strong>{healthNames[item.snapshot.health.state]}</strong><ul>{item.snapshot.health.reasons.map(reason => <li key={reason.code}>{reason.message}{reason.amount > 0 && ` ${money(reason.amount)}`}</li>)}</ul></> : <p>Preview a decision to see its effect and explanation.</p>}</aside>)}</div>
  </section>
}
