// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { BACKUP_KEY, STORAGE_KEY } from './storage'

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear() })
async function saved() { await waitFor(() => expect(screen.getByTestId('save-status')).toHaveTextContent('Saved on this device')) }
async function purchase(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Name'), 'Persistent lunch')
  await user.type(screen.getByLabelText('Amount (₹)'), '100.01')
  await user.click(screen.getByRole('button', { name: 'Add expense' }))
  await saved()
}

describe('persistent React workspace', () => {
  it('restores exact committed values on remount and keeps editor drafts temporary', async () => {
    const user = userEvent.setup()
    const first = render(<App />); await saved(); await purchase(user)
    await user.type(screen.getByLabelText('Name'), 'Unsubmitted draft')
    expect(screen.getByTestId('cash-balance')).toHaveTextContent('₹9,849.99')
    first.unmount(); render(<App />); await saved()
    expect(screen.getByTestId('cash-balance')).toHaveTextContent('₹9,849.99')
    expect(screen.getByText('Persistent lunch')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('')
  })
  it('keeps a What If preview out of storage and unavailable after refresh', async () => {
    const user = userEvent.setup(); const first = render(<App />); await saved()
    const before = localStorage.getItem(STORAGE_KEY)
    await user.click(screen.getByRole('button', { name: 'What If' }))
    await user.type(screen.getByLabelText('Scenario name'), 'Temporary idea')
    await user.type(screen.getByLabelText('Scenario amount (₹)'), '500')
    await user.click(screen.getByRole('button', { name: 'Preview decision' }))
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
    first.unmount(); render(<App />); await saved()
    await user.click(screen.getByRole('button', { name: 'What If' }))
    expect(screen.getByRole('button', { name: 'Apply decision' })).toBeDisabled()
    expect(screen.getByTestId('whatif-current-cash')).toHaveTextContent('₹9,950.00')
  })
  it('does not silently overwrite corrupt storage and repairs it on Reset sample', async () => {
    localStorage.setItem(STORAGE_KEY, 'broken'); localStorage.setItem(BACKUP_KEY, 'bad backup')
    const user = userEvent.setup(); render(<App />)
    expect(screen.getByText(/Saved data is damaged/)).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('broken')
    await user.click(screen.getByRole('button', { name: 'Reset sample' })); await saved()
    expect(screen.queryByText(/Saved data is damaged/)).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(localStorage.getItem(BACKUP_KEY))
    cleanup(); render(<App />); await saved()
    expect(screen.getByTestId('cash-balance')).toHaveTextContent('₹9,950.00')
  })
  it('shows backup recovery while retaining the saved financial data', async () => {
    const user = userEvent.setup(); const first = render(<App />); await saved(); await purchase(user)
    first.unmount(); localStorage.setItem(STORAGE_KEY, 'bad primary')
    render(<App />); await saved()
    expect(screen.getByText(/Recovered the last valid backup/)).toBeInTheDocument()
    expect(screen.getByTestId('cash-balance')).toHaveTextContent('₹9,849.99')
  })
  it('lets all controls work when browser storage access is denied', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError') })
    const user = userEvent.setup(); render(<App />)
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveTextContent('Could not save'))
    await user.type(screen.getByLabelText('Name'), 'Unsaved lunch')
    await user.type(screen.getByLabelText('Amount (₹)'), '100')
    await user.click(screen.getByRole('button', { name: 'Add expense' }))
    expect(screen.getByTestId('cash-balance')).toHaveTextContent('₹9,850.00')
    await user.click(screen.getByRole('button', { name: 'Start fresh' }))
    expect(screen.getByTestId('cash-balance')).toHaveTextContent('₹10,000.00')
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveTextContent('Could not save'))
  })
})
