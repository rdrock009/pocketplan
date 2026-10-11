import { useState } from 'react'
import type { FormEvent } from 'react'
import { calculateFinancials, isoDate, rupees } from '../finance'
import type { Paise } from '../finance'
import type { MonthAction, MonthState } from './state'
import { transactionDate } from './state'
import { dateLabel, money } from './format'
import { entryNames } from './entries'
import type { EntryKind } from './entries'

interface Props {
  kind: EntryKind
  state: MonthState
  onAction: (action: MonthAction) => boolean
}

function text(data: FormData, key: string): string {
  const value = data.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function positiveAmount(data: FormData, key = 'amount'): Paise {
  const value = rupees(text(data, key))
  if (value <= 0) throw new RangeError('Enter an amount greater than ₹0, with at most two decimal places.')
  return value
}

const descriptions: Record<EntryKind, string> = {
  income: 'Record money received, or plan income that has not arrived yet.',
  expense: 'Log a purchase or link a payment to an outstanding bill.',
  commitment: 'Set aside money for a dated, one-off bill.',
  subscription: 'Include every renewal that falls within your month.',
  savings: 'Give your savings a target, then move funds into or out of it.',
}

export function EntryForm({ kind, state, onAction }: Props) {
  const [status, setStatus] = useState<'received' | 'planned'>('received')
  const [recurrence, setRecurrence] = useState('monthly')
  const [savingsAction, setSavingsAction] = useState<'goal' | 'transfer'>('goal')
  const [error, setError] = useState<string | null>(null)
  const snapshot = calculateFinancials(state.plan, state.asOf)
  const date = transactionDate(state)
  const transfer = kind === 'savings' && savingsAction === 'transfer'
  const bills = snapshot.obligations.filter(item => item.remaining > 0)
  const posted = kind === 'expense' || transfer || (kind === 'income' && status === 'received')
  const submitLabel = transfer ? 'Record transfer' : {
    income: 'Add income', expense: 'Add expense', commitment: 'Add commitment', subscription: 'Add subscription', savings: 'Create savings goal',
  }[kind]

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      const id = crypto.randomUUID()
      const amount = positiveAmount(data)
      const enteredDate = isoDate(text(data, 'date'))
      const label = text(data, 'label')
      if (!transfer && !label) throw new RangeError('Give this entry a name.')
      let action: MonthAction
      switch (kind) {
        case 'income': action = { type: 'add-income', item: { id, label, amount, date: enteredDate, status } }; break
        case 'expense': {
          const bill = bills.find(item => JSON.stringify(item.reference) === text(data, 'obligation'))
          action = { type: 'add-expense', item: { id, label, amount, date: enteredDate, ...(bill ? { obligation: bill.reference } : {}) } }
          break
        }
        case 'commitment': action = { type: 'add-commitment', item: { id, label, amount, dueDate: enteredDate } }; break
        case 'subscription': {
          const endsOn = text(data, 'endsOn')
          action = { type: 'add-subscription', item: {
            id, label, amount, firstDueDate: enteredDate,
            recurrence: recurrence === 'monthly' ? { kind: 'monthly' } : { kind: 'every-days', intervalDays: recurrence === 'weekly' ? 7 : Number(text(data, 'interval')) },
            ...(endsOn ? { endsOn: isoDate(endsOn) } : {}),
          } }
          break
        }
        case 'savings': {
          if (transfer) {
            const goalId = text(data, 'goalId')
            const direction = text(data, 'direction')
            if (direction !== 'deposit' && direction !== 'withdrawal') throw new RangeError('Choose deposit or withdrawal.')
            action = { type: 'transfer', item: { id, goalId, amount, date: enteredDate, direction } }
          } else {
            const openingSaved = rupees(text(data, 'openingSaved') || '0')
            if (openingSaved < 0) throw new RangeError('Already saved cannot be negative.')
            action = { type: 'add-goal', item: { id, label, target: amount, openingSaved, targetDate: enteredDate } }
          }
          break
        }
      }
      setError(null)
      if (onAction(action)) form.reset()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Check your entry and try again.')
    }
  }

  return (
    <div className="entry-editor">
      <h3>{entryNames[kind]}</h3>
      <p className="muted">{descriptions[kind]}</p>
      {kind === 'savings' && <div className="segmented" role="group" aria-label="Savings action">
        <button type="button" aria-pressed={!transfer} onClick={() => { setSavingsAction('goal'); setError(null) }}>New goal</button>
        <button type="button" aria-pressed={transfer} onClick={() => { setSavingsAction('transfer'); setError(null) }}>Move money</button>
      </div>}
      {transfer && state.plan.savingsGoals.length === 0 ? <p className="empty-state">Create a savings goal first, then deposit or withdraw money here.</p> :
        <form onSubmit={submit} key={`${kind}-${savingsAction}`}>
          <div className="form-grid">
            {transfer ? <>
              <label>Savings goal<select name="goalId" required>{state.plan.savingsGoals.map(goal => <option key={goal.id} value={goal.id}>{goal.label}</option>)}</select></label>
              <label>Direction<select name="direction"><option value="deposit">Deposit into savings</option><option value="withdrawal">Withdraw into cash</option></select></label>
            </> : <label className="wide">Name<input name="label" placeholder={{ income: 'e.g. Weekend tutoring', expense: 'e.g. Lunch', commitment: 'e.g. Room rent', subscription: 'e.g. Music membership', savings: 'e.g. Emergency buffer' }[kind]} required maxLength={100} /></label>}
            <label>{kind === 'savings' && !transfer ? 'Target amount (₹)' : 'Amount (₹)'}<input name="amount" type="text" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" placeholder="0.00" required maxLength={18} /></label>
            <label>{posted ? 'Transaction date' : kind === 'savings' ? 'Target date' : kind === 'subscription' ? 'First renewal date' : kind === 'income' ? 'Expected date' : 'Due date'}
              <input name="date" type="date" min={state.plan.startDate} max={posted ? snapshot.endDate : undefined} defaultValue={posted ? date : snapshot.endDate} required />
            </label>
            {kind === 'income' && <label className="wide">Income status<select value={status} onChange={event => setStatus(event.target.value === 'planned' ? 'planned' : 'received')}><option value="received">Received — add to cash</option><option value="planned">Planned — forecast only</option></select></label>}
            {kind === 'expense' && <label className="wide">Payment for<select name="obligation"><option value="">Everyday / unexpected spending</option>{bills.map(item => <option key={JSON.stringify(item.reference)} value={JSON.stringify(item.reference)}>{item.label} · {dateLabel(item.dueDate)} · {money(item.remaining)} left</option>)}</select></label>}
            {kind === 'subscription' && <>
              <label>Renewal frequency<select value={recurrence} onChange={event => setRecurrence(event.target.value)}><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="custom">Every N days</option></select></label>
              {recurrence === 'custom' ? <label>Days between renewals<input name="interval" type="number" min="1" max="366" step="1" defaultValue="14" required /></label> : <label>Last renewal date (optional)<input name="endsOn" type="date" min={state.plan.startDate} /></label>}
            </>}
            {kind === 'savings' && !transfer && <label className="wide">Already saved (₹, outside your opening cash)<input name="openingSaved" type="text" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" defaultValue="0" maxLength={18} /></label>}
          </div>
          {error && <p role="alert" className="form-error">{error}</p>}
          <div className="form-footer"><button type="submit" className="button primary">{submitLabel}</button><p className="fine-print">{posted ? 'Recording a later transaction advances the snapshot day.' : 'Dates beyond this month are kept, but excluded from this month’s reserves.'}</p></div>
        </form>}
    </div>
  )
}
