# Changelog

All notable changes to PocketPlan are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-10-11

### Added
- **Dark Mode Support**: Persisted, system-aware theme preference with instant switching.
- **Forecast Trajectory Chart**: Zero-dependency inline SVG cash trajectory with danger-threshold alert shading.
- **Application Error Boundary**: Root-level error boundary preventing white-screen crashes with friendly recovery actions.
- **Modular Component Architecture**: Extracted focused components (`ForecastChart`, `Amount`, `ErrorBoundary`, `Header`, `OverviewSection`, `ForecastSection`, `ModeBanner`).
- **Data Export & Backup**: One-click JSON backup download to preserve and archive local workspace plans.
- **Enhanced Mobile & Reflow Styles**: Responsive breakpoints (`1050px`, `850px`, `700px`, `600px`, `360px`) and WCAG 44px touch targets across all interactive controls.
- **Open Source Documentation**: Comprehensive `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, and rich package metadata.

### Changed
- Refactored `App.tsx` into a clean layout coordinator.
- Optimized performance via `useMemo` for derived financial snapshot computations.
- Hardened `useTheme` hook with safe fallback checks for non-browser/test environments.

## [1.0.0] - 2026-10-11

### Initial Release
- **My Month**: Complete 30-day personal finance management engine (income, expenses, bills, subscriptions, savings).
- **What If**: Interactive scenario previewing, application, and undo without dirtying persistent records.
- **Persistence**: Validated, double-buffered `localStorage` engine with automatic recovery.
- **Pure Arithmetic**: 100% integer-based paise calculation avoiding floating-point inaccuracy.
