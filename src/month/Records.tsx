import { calculateFinancials } from '../finance'
import type { FinancialSnapshot } from '../finance'
import type { EntryKind } from './entries'
import { dateLabel, money } from './format'
import type { MonthAction, MonthState } from './state'
import { transactionDate } from './state'

interface Props { kind: EntryKind; state: MonthState; snapshot: FinancialSnapshot; onAction: (action: MonthAction) => boolean }

export function Records({ kind, state, snapshot, onAction }: Props) {
  const { plan } = state
  const remove = (collection: Extract<MonthAction, { type: 'remove' }>['collection'], id: string, label: string) => <button type="button" className="text-button danger" aria-label={`Remove ${label}`} onClick={() => onAction({ type: 'remove', collection, id })}>Remove</button>
  const empty = (message: string) => <p className="empty-state">{message}</p>
  return (
    <div className="records">
      <h3>{{ income: 'Your income', expense: 'Spending log', commitment: 'Dated commitments', subscription: 'Your subscriptions', savings: 'Your goals' }[kind]}</h3>
      {kind === 'income' && (plan.incomes.length === 0 ? empty('No income recorded. Add confirmed money or a planned payment using the form.') : <ul className="record-list">{plan.incomes.map(item => <li key={item.id}>
        <div><strong>{item.label}</strong><span className="record-meta">{dateLabel(item.date)} · {item.status === 'received' ? 'Received' : item.date <= state.asOf ? 'Planned · overdue' : 'Planned'}</span></div>
        <div className="record-amount">{money(item.amount)}</div>
        <div className="row-actions">{item.status === 'planned' && <button type="button" className="text-button" aria-label={`Receive now: ${item.label}`} onClick={() => onAction({ type: 'receive-income', id: item.id, date: transactionDate(state) })}>Receive now</button>}{remove('incomes', item.id, item.label)}</div>
      </li>)}</ul>)}
      {kind === 'expense' && (plan.expenses.length === 0 ? empty('No expenses yet. Everyday spending and bill payments will appear here.') : <ul className="record-list">{[...plan.expenses].sort((a, b) => b.date.localeCompare(a.date)).map(item => <li key={item.id}>
        <div><strong>{item.label}</strong><span className="record-meta">{dateLabel(item.date)} · {item.obligation ? 'Linked bill payment' : item.forecastTreatment === 'one-off' ? 'One-off cost' : 'Everyday / unexpected'}</span></div><div className="record-amount">{money(item.amount)}</div><div className="row-actions">{remove('expenses', item.id, item.label)}</div>
      </li>)}</ul>)}
      {kind === 'commitment' && (plan.commitments.length === 0 ? empty('No dated bills. Add rent, fees, or another one-off payment to protect the money it needs.') : <ul className="record-list">{plan.commitments.map(item => {
        const outstanding = snapshot.obligations.find(bill => bill.reference.kind === 'commitment' && bill.reference.commitmentId === item.id)
        return <li key={item.id}><div><strong>{item.label}</strong><span className="record-meta">Due {dateLabel(item.dueDate)} · {outstanding ? outstanding.remaining === 0 ? 'Paid' : `${money(outstanding.remaining)} outstanding` : 'Beyond this month'}</span></div><div className="record-amount">{money(item.amount)}</div><div className="row-actions">{remove('commitments', item.id, item.label)}</div></li>
      })}</ul>)}
      {kind === 'subscription' && (plan.subscriptions.length === 0 ? empty('No subscriptions. Add a recurring payment to include its renewals in your forecast.') : <ul className="record-list">{plan.subscriptions.map(item => <li key={item.id}>
        <div><strong>{item.label}</strong><span className="record-meta">{item.recurrence.kind === 'monthly' ? 'Monthly' : `Every ${item.recurrence.intervalDays} days`} · First {dateLabel(item.firstDueDate)}{item.endsOn ? ` · Ends ${dateLabel(item.endsOn)}` : ''}</span></div><div className="record-amount">{money(item.amount)}<span className="record-meta">per renewal</span></div><div className="row-actions"><button type="button" className="text-button" disabled={item.endsOn !== undefined && item.endsOn <= state.asOf} aria-label={`Stop renewals: ${item.label}`} onClick={() => onAction({ type: 'cancel-subscription', id: item.id })}>Stop renewals</button>{remove('subscriptions', item.id, item.label)}</div>
      </li>)}</ul>)}
      {kind === 'savings' && <>
        {plan.savingsGoals.length === 0 ? empty('No savings goals yet. Set a target, then use Move money to fund it.') : <ul className="goal-list">{plan.savingsGoals.map(goal => {
          const progress = snapshot.savings.find(item => item.goalId === goal.id)
          if (!progress) return null
          return <li key={goal.id}><div className="goal-heading"><strong>{goal.label}</strong>{remove('savingsGoals', goal.id, goal.label)}</div><p><span className="record-amount">{money(progress.saved)}</span> <span className="muted">of {money(goal.target)}</span></p><progress value={Math.min(progress.saved, goal.target)} max={Math.max(1, goal.target)} aria-label={`${goal.label} savings progress`} /><p className="record-meta">Target {dateLabel(goal.targetDate)} · {money(progress.reserved)} still reserved this month</p></li>
        })}</ul>}
        {plan.savingsTransfers.length > 0 && <><h4>Savings transfers</h4><ul className="record-list">{plan.savingsTransfers.map(item => <li key={item.id}><div><strong>{plan.savingsGoals.find(goal => goal.id === item.goalId)?.label ?? 'Savings'}</strong><span className="record-meta">{dateLabel(item.date)} · {item.direction === 'deposit' ? 'Deposit' : 'Withdrawal'}</span></div><div className="record-amount">{money(item.amount)}</div><div className="row-actions">{remove('savingsTransfers', item.id, `${item.direction} ${dateLabel(item.date)}`)}</div></li>)}</ul></>}
      </>}
    </div>
  )
}

export function UpcomingBills({ state, onAction }: Omit<Props, 'kind' | 'snapshot'>) {
  const snapshot = calculateFinancials(state.plan, state.asOf)
  const bills = snapshot.obligations.filter(item => item.remaining > 0)
  return <section className="bill-section" aria-labelledby="bill-title"><div className="section-heading"><h2 id="bill-title">Money already spoken for</h2><span>{money(snapshot.obligationReserve)}</span></div>
    {bills.length === 0 ? <p className="empty-state">No unpaid bills in this month. Add a commitment or subscription to reserve its cost.</p> : <ul className="bill-list">{bills.map(item => <li key={JSON.stringify(item.reference)}><div><strong>{item.label}</strong><span className="record-meta">{item.reference.kind === 'subscription' ? 'Subscription' : 'Commitment'} · {item.overdue ? 'Overdue since' : 'Due'} {dateLabel(item.dueDate)}{item.paid > 0 ? ` · ${money(item.paid)} paid` : ''}</span></div><span className="record-amount">{money(item.remaining)}</span><button type="button" className="button small" aria-label={`Pay remaining for ${item.label} due ${dateLabel(item.dueDate)}`} onClick={() => onAction({ type: 'pay', id: crypto.randomUUID(), obligation: item, date: transactionDate(state) })}>Pay remaining</button></li>)}</ul>}
    <p className="fine-print">Pay remaining records a payment on the snapshot day. For a partial payment, add an expense linked to the bill.</p>
  </section>
}
