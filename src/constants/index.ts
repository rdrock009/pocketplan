/**
 * Core Application Constants
 */
export const APP_NAME = 'PocketPlan'
export const APP_VERSION = '1.1.0'
export const CURRENCY_SYMBOL = '₹'
export const DEFAULT_HORIZON_DAYS = 30
export const DEFAULT_OPENING_BUDGET = '₹10,000.00'

export const HEALTH_LABELS: Record<'healthy' | 'caution' | 'critical', string> = {
  healthy: 'On track',
  caution: 'Needs attention',
  critical: 'Shortfall risk',
}

export const STORAGE_KEYS = {
  WORKSPACE: 'budget-lab:workspace',
  BACKUP: 'budget-lab:workspace:backup',
  RECOVERY: 'budget-lab:workspace:recovery',
  THEME: 'pocketplan:theme',
} as const
