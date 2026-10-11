import { memo } from 'react'
import type { calculateFinancials } from '../finance'
import { money } from '../month/format'
import type { useLocalWorkspace } from '../persistence/useLocalWorkspace'
import { Amount } from './Amount'

interface Props {
  snapshot: ReturnType<typeof calculateFinancials>
  state: ReturnType<typeof useLocalWorkspace>['workspace']['month']
  healthLabel: string
}

/**
 * Overview section displaying cash balance, spendable cash, daily allowance,
 * financial calculation breakdown disclosure, and month health indicator.
 */
export const OverviewSection = memo(function OverviewSection({ snapshot, state, healthLabel }: Props) {
  return (
    <section className="overview" aria-labelledby="overview-title">
      <div className="overview-main">
        <div className="section-heading">
          <h2 id="overview-title">Room to spend</h2>
          <span data-testid="days-remaining">{snapshot.daysRemaining} days left</span>
        </div>
        <dl className="money-strip">
          <div><dt>Cash balance</dt><dd><Amount value={snapshot.cashBalance} id="cash-balance" /></dd></div>
          <div><dt>Free after reserves</dt><dd><Amount value={snapshot.spendableCash} id="spendable-cash" /></dd></div>
          <div className="allowance"><dt>Safe daily allowance</dt><dd><Amount value={snapshot.dailyAllowance} id="daily-allowance" /><span className="per-day"> / day</span></dd></div>
        </dl>
        <p className="allowance-note">
          {snapshot.daysRemaining === 0
            ? 'Your month is complete. The forecast settles any outstanding reserves.'
            : 'Your daily allowance protects unpaid bills and savings targets. It uses confirmed cash only.'}
        </p>
        <details className="breakdown">
          <summary>How your available money is calculated</summary>
          <dl>
            <div><dt>Starting cash</dt><dd>{money(state.plan.openingCash)}</dd></div>
            <div><dt>Received income</dt><dd><Amount value={snapshot.receivedIncome} id="received-income" /></dd></div>
            <div><dt>Expenses paid</dt><dd><Amount value={snapshot.expensesPaid} id="expenses-paid" /></dd></div>
            <div><dt>Net deposits into savings</dt><dd><Amount value={snapshot.netSavingsDeposits} id="net-savings" /></dd></div>
            <div><dt>Unpaid bills reserved</dt><dd><Amount value={snapshot.obligationReserve} id="bill-reserve" /></dd></div>
            <div><dt>Unfunded savings reserved</dt><dd><Amount value={snapshot.savingsReserve} id="savings-reserve" /></dd></div>
          </dl>
          <p className="fine-print">
            Cash = starting cash + received income − expenses − net savings deposits. Free cash = cash − bill reserves − savings reserves.
          </p>
        </details>
      </div>
      <aside className={`health health-${snapshot.health.state}`} aria-labelledby="health-title">
        <div className="section-heading">
          <h2 id="health-title">Month health</h2>
          <span className="health-badge" data-testid="health-state">{healthLabel}</span>
        </div>
        <ul>
          {snapshot.health.reasons.map(reason => (
            <li key={reason.code}>
              {reason.message}
              {reason.amount > 0 && <strong> {money(reason.amount)}</strong>}
            </li>
          ))}
        </ul>
        <p className="fine-print">Based on your entries and the forecast assumptions below.</p>
      </aside>
    </section>
  )
})
