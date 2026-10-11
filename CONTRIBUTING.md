# Contributing to PocketPlan

Thank you for contributing to PocketPlan! We welcome contributions, bug fixes, and suggestions to make personal financial planning clearer, faster, and more reliable.

## Code of Conduct

Please review and adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

## Development Setup

1. **Clone the repository**:
   ```sh
   git clone https://github.com/rdrock009/pocketplan.git
   cd pocketplan
   ```

2. **Install dependencies**:
   ```sh
   npm ci
   ```

3. **Start local development server**:
   ```sh
   npm run dev
   ```

## Verification & Quality Standards

Before opening a pull request or submitting changes, all checks must pass with zero errors:

```sh
# Type-checking
npm run typecheck

# Linting (zero warnings permitted)
npm run lint

# Test suite (all test files must pass)
npm test

# Production build
npm run build
```

## Architectural Guidelines

- **Pure Financial Engine**: All monetary arithmetic must remain in `src/finance/`. Monetary figures are represented as integer paise (`Paise`) to eliminate floating-point rounding errors.
- **Shared State**: Views derive their figures from the common engine snapshot. Do not replicate financial logic in UI components.
- **Persistence Safety**: Workspace storage validates types, dates, and schema versions on load with fallback to backup.
- **Accessibility & Touch Targets**: Interactive controls must maintain a minimum 44px tap target and clear visible focus rings.

## Pull Request Process

1. Create a feature branch: `git checkout -b feature/your-feature-name`.
2. Commit clear, descriptive messages following Conventional Commits format (`feat:`, `fix:`, `docs:`, `refactor:`).
3. Ensure all tests pass (`npm test`, `npm run lint`, `npm run build`).
4. Submit your pull request against the `main` branch.
