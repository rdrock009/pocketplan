# pocketplan

**Plan your month. Understand your money. Preview your next decision.**

pocketplan is a personal finance app built with React, TypeScript, Vite, and Tailwind CSS. It starts with a ₹10,000 budget over a 30-day horizon and helps you manage income, expenses, bills, subscriptions, and savings.

Use **My Month** to manage your committed plan and **What If** to compare a financial decision before applying it. Every balance, allowance, forecast, and health explanation comes from the same tested calculation engine.

No account, bank connection, backend, API key, or external service is required. Committed changes are saved in your browser.

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [Using the app](#using-the-app)
- [Financial model](#financial-model)
- [Scenario safety](#scenario-safety)
- [Persistence and recovery](#persistence-and-recovery)
- [Technology and structure](#technology-and-structure)
- [Commands and tests](#commands-and-tests)
- [Production build and hosting](#production-build-and-hosting)
- [Verified results](#verified-results)
- [Limitations](#limitations)
- [Troubleshooting](#troubleshooting)
- [Contributing and license](#contributing-and-license)

## Features

### My Month

- Track planned and received income.
- Record dated expenses and link payments to the bills they settle.
- Manage commitments with full or partial payments.
- Track monthly, weekly, and custom-interval subscriptions.
- Create savings goals and deposit or withdraw funds.
- View confirmed cash, bill reserves, savings reserves, free cash, and daily allowance.
- Inspect daily forecast balances, shortfall timing, and explainable health states.
- Adjust the snapshot date to view the plan at the end of a chosen day.
- Explore labelled fictional sample data, start a fresh month, or reset the sample.

### What If

| Scenario | Proposed change |
| --- | --- |
| Purchase | Adds a one-off expense |
| Emergency cost | Adds a one-off unexpected expense |
| Extra income | Adds received or planned income |
| Subscription cancellation | Stops future renewals while preserving existing obligations |
| Savings-target change | Changes a goal's target and/or deadline |

Compare current versus proposed cash, free cash, daily allowance, and closing forecast. Expand **More comparison details** for reserves, saved funds, expected income, snapshot dates, and shortfall timing.

Preview without changing your month, Apply a valid decision, Discard it, or Undo an applied decision. Repeated application of the same decision cannot create duplicate transactions.

### Interface and resilience

Responsive layouts, labelled native controls, visible keyboard focus, a skip link, and expandable disclosures support everyday use. Versioned persistence validates saved data, maintains a backup, and shows recovery or storage warnings without stopping the app.

## Quick start

### Requirements

- Node.js matching `^22.13.0 || ^24.0.0 || >=26.0.0`.
- npm.
- A modern browser with JavaScript enabled.

Verified with **Node.js 24.19.0** and **npm 11.9.0**. No environment variables are needed.

From a clone of this repository:

```sh
cd pocketplan
npm ci
npm run dev
```

If using the downloadable project ZIP, extract it first and open the included **budget-lab** folder in your terminal. That is the current archive folder name.

Open the URL printed by Vite, normally **http://127.0.0.1:5173**. You should see **My Month** and the labelled fictional sample. Vite may choose another port if 5173 is occupied.

> The repository name is pocketplan. Existing package metadata, archive folders, and browser storage keys still use `budget-lab`; this does not affect functionality.

## Using the app

### Choose a starting point

The fictional sample uses October 2026, with a snapshot at the end of 7 October. It includes income, everyday spending, rent, a music subscription, and an emergency savings goal.

Choose a **New month start date** and select **Start fresh** for a clean ₹10,000, 30-day plan. **Reset sample** restores the original sample. Both replace the current month and clear previews and Undo history.

### Manage your month

Under **Make this month yours**, select the appropriate form:

- **Income:** add planned or received income. **Receive now** changes an existing planned entry into received income rather than adding another record.
- **Expenses:** enter an amount and date. Link a bill payment to its commitment or exact subscription renewal to reduce the matching reserve.
- **Commitments:** record a dated bill. Use **Pay remaining**, or record linked partial payments.
- **Subscriptions:** choose a recurrence and first renewal date. **Stop renewals** retains earlier unpaid bills and prepaid renewal references.
- **Savings:** create a goal, then use **Move money** to deposit or withdraw funds. Withdrawals cannot exceed saved funds.
- **Remove:** reverse an entry. Remove linked payments or savings transfers before removing their associated bill, subscription, or goal.

Successful changes update all derived values together. Invalid changes explain the problem and preserve the previous valid plan.

### Set the snapshot date

Choose a **Snapshot day**, then click **Apply**. A snapshot represents the end of that day and cannot precede recorded transactions. Posting a later in-month transaction automatically advances the snapshot. When the horizon is complete, the daily allowance is zero.

### Preview a decision

Open **What If**, select a scenario, complete its fields, and choose **Preview**. Review the proposed amounts and health explanations.

- **Apply** validates and commits the preview against the current month.
- **Discard** clears it without changing committed data.
- **Undo** reverses applied What If decisions in reverse order.

Editing a draft invalidates its previous preview. A successful My Month edit, snapshot change, or reset clears scenario Undo history so Undo cannot overwrite later manual changes.

### Return later

Committed data and validated Undo history survive refresh in the same browser profile and origin. Unapplied previews and editor drafts do not.

## Financial model

### Exact money and dates

All monetary values use **safe-integer paise**: ₹10,000 is `1_000_000` paise. Decimal input is parsed exactly, without floating-point rupee arithmetic. Unsafe arithmetic and invalid input are rejected.

Dates are validated `YYYY-MM-DD` calendar dates with UTC arithmetic. The pure engine never reads the system clock; identical inputs produce identical results.

The app uses a 30-day inclusive horizon. The engine supports horizons from 1 through 366 days. Its initial snapshot is the day before the plan starts, leaving the full horizon available.

### Core calculations

```text
Confirmed cash = opening cash + received income − paid expenses − net savings deposits
Free cash = confirmed cash − unpaid bill reserve − unfunded savings reserve
Daily allowance = floor(max(0, free cash) / remaining days)
```

The daily allowance rounds down to whole paise and is zero when no days remain. Planned future income contributes to projections, not confirmed cash. A separately identified projected allowance includes eligible planned income. Overdue planned income is excluded until its status or date is corrected.

### Double-counting prevention

- Opening cash is already funded; do not enter it again as income.
- Income is planned or received. Receiving it updates the same record.
- Linked bill payments reduce cash once and reduce the corresponding reserve.
- Subscription payments link to individual renewal dates.
- Savings deposits move money into savings; they are not also expenses.
- Opening saved funds are outside opening cash and are not deducted again.
- Savings reserves cover only the unfunded portion of goals due within the horizon.
- What If purchases and emergencies are one-off expenses excluded from ongoing spending pace.
- Record IDs are globally unique; applied scenario IDs are consumed once.

Represent each real-world bill once, as either a commitment or a subscription renewal. Similar names or amounts do not automatically identify duplicate real-world bills. Unlinked expenses do not implicitly settle obligations.

### Forecast assumptions

The forecast schedules outstanding bills, eligible planned income, and savings funding on their dates. Overdue unpaid obligations move to the first remaining day. Posted payments and savings deposits are not projected again.

Future discretionary spending extrapolates the daily average of ordinary unlinked expenses over elapsed calendar days. Linked payments, savings transfers, and one-off expenses are excluded. With no history, the spending pace is zero; unknown living costs are not inferred.

Forecasts include daily closing cash, minimum balance, first shortfall date, and closing cash without planned income. They model end-of-day balances rather than intraday liquidity.

At the end of the horizon, outstanding reserves enter a terminal settlement forecast without posting another actual debit. Forecast funding moved into savings remains saved wealth outside closing cash.

Monthly renewal dates preserve their original anchor: January 31 becomes February 28 or 29, then March 31. A subscription's `endsOn` date is inclusive.

### Explainable health

| State | Rule |
| --- | --- |
| **Critical** | Confirmed cash is negative or a forecast daily closing balance becomes negative |
| **Caution** | Reserves exceed confirmed cash, an obligation or income is overdue, a savings deadline is missed, or avoiding a projected deficit depends on planned income |
| **Healthy** | None of those conditions apply under the stated assumptions |

Each state includes stable reason codes, plain-language explanations, and associated amounts. Health is a deterministic budgeting indicator, not a credit score.

### Engine example

From a module inside `src`:

```ts
import { calculateFinancials, createPlan, isoDate, rupees } from './finance'

const plan = {
  ...createPlan(isoDate('2026-10-01')),
  commitments: [
    {
      id: 'rent',
      label: 'Rent',
      amount: rupees('3000'),
      dueDate: isoDate('2026-10-10'),
    },
  ],
}

const snapshot = calculateFinancials(plan)
// cashBalance: 1_000_000 paise
// spendableCash: 700_000 paise
// dailyAllowance: 23_333 paise over the initial 30 days
```

## Scenario safety

Each preview receives a decision ID. Apply checks its ID and state revision, recomputes against the live month, and commits atomically.

Applied decision IDs remain consumed after Undo or Reset. Retrying the same decision cannot apply it again. A deliberate new preview receives a new ID and can represent a separate intentional transaction.

Undo stores validated prior month snapshots. Successful manual edits clear this history; invalid edits preserve the valid plan and any valid preview.

Subscription cancellation preserves historical obligations and prepaid references. Changing a savings target does not withdraw saved money or create a transfer. Later posted scenario dates advance the proposed snapshot, which is visible in the comparison.

## Persistence and recovery

Version 1 uses browser `localStorage`:

| Key | Purpose |
| --- | --- |
| `budget-lab:workspace` | Current committed workspace |
| `budget-lab:workspace:backup` | Second copy of the latest successful save |
| `budget-lab:workspace:recovery` | Damaged primary data preserved when possible |

Stored fields include the plan, snapshot date, sample/fresh mode, revision, consumed scenario IDs, and Undo snapshots. Calculated totals, previews, editor drafts, UI selections, errors, and notices are not stored.

Loading reconstructs known fields and validates types, dates, enums, safe-integer amounts, IDs, references, and financial invariants. Every Undo snapshot is validated by the engine.

- Invalid primary data falls back to a valid backup with a visible message.
- If both active copies are invalid or unsupported, sample data loads without automatically overwriting saved bytes.
- A successful committed edit or explicit reset can replace invalid data. Damaged primary bytes are preserved in the recovery key when possible.
- Access or quota failures show a warning while the app continues in memory. The next committed change retries saving.
- Start fresh and Reset sample replace both active copies, preventing previous entries from returning through backup recovery.

Limits: 2 MB of JSON text, 2,000 entries per financial collection, 50 Undo snapshots, and 10,000 consumed decision IDs. Exceeding a save limit preserves current in-memory edits and reports the failure.

Storage belongs to the browser profile and origin. Different ports, domains, or protocols have separate data. Tabs do not live-sync; reloading uses the latest saved state.

The app does not encrypt local storage. Clearing browser site data removes saved plans. The recovery key may retain damaged earlier data after a reset; clearing all three keys removes it.

## Technology and structure

| Area | Technology |
| --- | --- |
| Interface | React 19 |
| Language | TypeScript 5.9 |
| Development/build | Vite 8 |
| Styling | Tailwind CSS 4 and application CSS |
| Static analysis | ESLint with TypeScript and React rules |
| Tests | Vitest, Testing Library, user-event, jsdom |
| Persistence | Validated, versioned localStorage |

TypeScript enables strict mode, checked indexed access, exact optional property types, and unused-code checks. ESLint warnings fail the lint command.

```text
src/
  components/    Modular UI components (Header, OverviewSection, ForecastChart, Amount, ErrorBoundary)
  constants/     Core application constants and configuration
  finance/       Typed model, money/date utilities, pure engine, tests
  hooks/         Custom React hooks (useTheme)
  month/         My Month forms, records, sample data, state, tests
  persistence/   Storage validation, recovery, React hook, tests
  types/         Centralized TypeScript type definitions
  whatif/        Scenarios, comparisons, preview/apply/undo state, tests
  App.tsx        Shared workspace layout and navigation coordinator
  App.test.tsx   Application interaction tests
  index.css      Tailwind import and accessible design system styles
  main.tsx       React entry point with ErrorBoundary
```

Further documentation:

- [PRODUCT.md](PRODUCT.md): product brief.
- [DESIGN.md](DESIGN.md): interface decisions.
- [QA.md](QA.md): functional and interface checks.
- [VALIDATION_REPORT.md](VALIDATION_REPORT.md): detailed results and qualifications.
- [PERFORMANCE_RESULTS.json](PERFORMANCE_RESULTS.json): performance measurements.
- [CONTRIBUTING.md](CONTRIBUTING.md): development guidelines and PR workflow.
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md): community standards.
- [SECURITY.md](SECURITY.md): security reporting and offline privacy guarantees.
- [CHANGELOG.md](CHANGELOG.md): version history and release notes.
- [LICENSE](LICENSE): MIT License.

## Commands and tests

| Command | Purpose |
| --- | --- |
| `npm ci` | Install dependencies from the lockfile |
| `npm run dev` | Start the development server |
| `npm run typecheck` | Run TypeScript checks |
| `npm run lint` | Run ESLint with zero warnings allowed |
| `npm test` | Run all tests once |
| `npm run build` | Type-check and create the production build |
| `npm run preview` | Serve the built app locally |
| `npm audit` | Check known dependency advisories |

Run the main checks before submitting changes:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Run financial and state tests separately:

```sh
npm exec vitest run src/finance/engine.test.ts src/month/state.test.ts src/whatif/state.test.ts
```

Tests cover exact money parsing, date boundaries, payment linking, double counting, recurrence, savings transfers, forecasts, health reasons, overflow, accounting conservation, immutability, preview isolation, repeated Apply, stale previews, Undo, resets, persistence validation, recovery, and React interactions.

Browser QA scripts under `.codex/qa` in the complete project archive use verification-environment browser and dependency paths. Adapt those paths to run them elsewhere.

## Production build and hosting

```sh
npm ci
npm run build
npm run preview
```

Open the printed preview URL, normally **http://127.0.0.1:4173**.

For static hosting:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Publish/output directory | `dist` |
| Node version | A version matching the package engines range |
| Environment variables | None required |

Use HTTPS for a public deployment. Vite preview is a local build check, not a production hosting service.

The configuration uses the default root base path. For a repository subpath such as `/pocketplan/`, set the appropriate `base` in `vite.config.ts` before building.

Moving from localhost to a deployed domain does not transfer browser data. No public deployment URL is listed because deployment has not yet been completed.

## Verified results

Recorded on **11 October 2026** for the implemented application:

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| ESLint | Passed with zero errors or warnings |
| Full test suite | 114 tests in 8 files passed |
| Financial/state tests | 67 tests in 3 files passed |
| Production build | Passed |
| Dependency audit | Zero known vulnerabilities reported at the time |
| Responsive checks | No page overflow at 1365px, 768px, 390px, or 320px |
| Automated accessibility | Zero axe violations in tested states |
| Browser flows | My Month, all scenarios, Apply/Discard/Undo, duplicate prevention, refresh, resets, and recovery passed |
| Runtime errors | None observed in checked flows |

Keyboard checks covered skip-link focus, navigation, disclosure activation, visible focus, and invalid-field focus. Validation rejected missing or whitespace-only names, malformed or overprecise amounts, zero amounts, unsafe integers, and out-of-horizon dates without changing committed data.

No custom dialogs exist, so custom dialog focus trapping and restoration are not applicable.

### Performance evidence

Three cache-disabled production loads per profile in Chromium:

| Metric | Desktop | Simulated mobile |
| --- | --- | --- |
| Median FCP | 72 ms | 960 ms |
| Median LCP | 72 ms | 960 ms |
| Maximum CLS | 0 | 0.00487 |
| Maximum measured interaction event duration | 32 ms | 112 ms |

Mobile simulation used a 390 × 844 viewport, 4× CPU slowdown, 150 ms latency, and 1.6 Mbps download bandwidth. Vite reported approximately **84.23 kB gzip JavaScript** and **5.59 kB gzip CSS**.

These are local lab results, not field INP, a Lighthouse score, or a deployed-site performance guarantee. See the validation report for methodology, browser-process reuse, and other qualifications.

## Limitations

- Forecasts depend on entered data and the stated assumptions; unrecorded costs are unknown.
- Currency is INR; multi-currency conversion is not implemented.
- No bank integration, account system, cloud sync, or cross-device persistence.
- Tabs do not live-sync and may overwrite each other's saved state.
- No export/import interface for personal plans.
- Controls work offline after assets load. A cold offline launch is unsupported because there is no service worker.
- Browser checks used Chromium and emulated mobile conditions. Safari, Firefox, physical phones, and manual screen-reader sessions were not tested.
- Native OS date-picker popup focus was not automated.
- Performance was measured with sample data and scenarios, not maximum storage payloads.
- Dependency audit results describe known advisories at the verification date, not a penetration test.
- Unsupported future persistence versions recover gracefully rather than automatically migrating.

## Troubleshooting

### I still see an older project

Stop the old development server, open a terminal in the newly extracted project folder, and run `npm ci` followed by `npm run dev`. Use the exact URL printed by that terminal; another server may occupy the usual port.

### npm reports an unsupported Node version

Check `node --version` and use a version matching the engines range. Reinstall with `npm ci` after changing Node versions.

### Refresh does not restore my changes

Check for a storage warning. Storage restrictions, quota limits, or a different origin can prevent restoration. Only committed data persists; previews and drafts are temporary.

### Sample data appears after a recovery warning

The saved data could not be validated. A valid backup is used when available; otherwise the sample loads. Start fresh and Reset sample replace the active saved month.

### A payment does not reduce a bill reserve

Link the expense to the correct commitment or subscription renewal date. Unlinked expenses are independent spending.

### Apply is disabled

Create a valid preview. Draft edits and successful My Month changes invalidate previous previews; preview the decision again.

## Contributing and license

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines. Keep financial calculations in the pure engine and derive displayed values from shared state.

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
