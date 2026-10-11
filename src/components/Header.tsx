import { memo } from 'react'

interface Props {
  surface: 'month' | 'what-if'
  setSurface: (surface: 'month' | 'what-if') => void
  effectiveTheme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  onExport?: () => void
}

/** Sun icon for light mode toggle */
function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

/** Moon icon for dark mode toggle */
function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

/** Download icon for backup export */
function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

/**
 * Global application top bar with brand logo, workspace switching,
 * theme toggle, and JSON backup export action.
 */
export const Header = memo(function Header({ surface, setSurface, effectiveTheme, setTheme, onExport }: Props) {
  return (
    <header className="app-bar">
      <div className="bar-inner">
        <a href="#main" className="brand" aria-label="PocketPlan home">
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
            <rect x="2" y="2" width="24" height="24" rx="7" fill="currentColor" />
            <path d="M9 9h10M9 14h7M9 19h4" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
          </svg>
          PocketPlan
        </a>
        <div className="bar-actions">
          <nav className="workspace-nav" aria-label="Workspace">
            <button
              type="button"
              aria-pressed={surface === 'month'}
              aria-controls="month-view"
              onClick={() => setSurface('month')}
            >
              My Month
            </button>
            <button
              type="button"
              aria-pressed={surface === 'what-if'}
              aria-controls="whatif-view"
              onClick={() => setSurface('what-if')}
            >
              What If
            </button>
          </nav>
          {onExport && (
            <button
              type="button"
              className="export-btn"
              onClick={onExport}
              title="Download JSON backup"
              aria-label="Download backup of current month"
            >
              <DownloadIcon />
              <span className="export-text">Export</span>
            </button>
          )}
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')}
            aria-label={effectiveTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={effectiveTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {effectiveTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>
    </header>
  )
})
