// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

afterEach(() => { cleanup(); localStorage.clear() })
it('keeps the main decision impacts visible and supporting values accessible through disclosure', async () => {
  const user = userEvent.setup(); render(<App />)
  await user.click(screen.getByRole('button', { name: 'What If' }))
  const table = screen.getByRole('table', { name: 'Main scenario impacts' })
  expect(within(table).getByRole('rowheader', { name: 'Safe daily allowance' })).toBeVisible()
  expect(within(table).getByRole('rowheader', { name: 'Forecast closing cash' })).toBeVisible()
  expect(screen.getByRole('table', { name: 'Supporting scenario impacts' })).not.toBeVisible()
  await user.click(screen.getByText('More comparison details'))
  expect(screen.getByRole('table', { name: 'Supporting scenario impacts' })).toBeVisible()
  await user.type(screen.getByLabelText('Scenario name'), 'Headphones')
  await user.type(screen.getByLabelText('Scenario amount (₹)'), '500')
  await user.click(screen.getByRole('button', { name: 'Preview decision' }))
  expect(screen.getByText('Preview only')).toBeVisible()
  expect(screen.getByTestId('whatif-proposed-daily')).toHaveTextContent('₹206.56')
  expect(screen.getByTestId('whatif-proposed-closing')).toHaveTextContent('₹3,301.00')
  expect(screen.getByTestId('whatif-proposed-bills')).toHaveTextContent('₹3,699.00')
  await user.click(screen.getByRole('button', { name: 'Apply decision' }))
  expect(screen.getByTestId('cash-balance')).toHaveTextContent('₹9,450.00')
  expect(screen.getByRole('button', { name: 'Apply decision' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Undo last decision' }))
  expect(screen.getByTestId('cash-balance')).toHaveTextContent('₹9,950.00')
})
