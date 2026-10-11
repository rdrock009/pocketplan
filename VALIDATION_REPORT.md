# Validation report — 11 October 2026

No material application failures were found. Application source and dependencies
were preserved. Added validation/performance verification and this report. The
performance harness was rerun with HTTP caching explicitly disabled and transfer
sizes verified through Chrome DevTools Protocol.

| Check | Actual result |
| --- | --- |
| `npm run typecheck` | Pass; strict TypeScript, exit 0 |
| `npm run lint` | Pass; zero ESLint errors/warnings, exit 0 |
| `npm test` | 114 tests in 8 files pass, exit 0 |
| Dedicated financial/state run | 67 tests in 3 files pass: 34 engine, 6 My Month state, 27 What If state |
| `npm run build` | Pass; Vite 8.3.4 production build, exit 0 |
| `npm audit --json` | 0 known vulnerabilities: critical/high/moderate/low/info all zero; 298 dependencies reported; exit 0 |
| Keyboard | Skip link focuses main; navigation/disclosures work; disclosure Enter activation passes; invalid native fields receive focus; error action retains visible focus |
| Form validation | Required name, malformed/overprecise decimal, zero, whitespace-only name, unsafe integer, and dates before/after the horizon all rejected; committed month and saved bytes unchanged |
| Dialog focus | No custom dialog, modal, or aria-modal surfaces exist. Focus trapping/restoration is not applicable; no dialog was added to manufacture a test |
| Responsive/axe | Chromium at 1365×1000, 768×1024, 390×844, and 320×800; no page overflow; zero axe violations in tested default, preview, expanded, empty, error, critical, and long-name states |
| Reflow/preferences | 683 CSS px simulates a 1366px display's reflow at 200% zoom; 125% text enlargement and reduced-motion preference pass |
| Functional regression | Full My Month and all five What If scenarios pass; Apply/Discard/Undo, repeated Apply, preview isolation, shared values, and local persistence pass |
| Storage recovery | Refresh, both reset modes, corrupted primary/backup, unsupported version, denied storage, and controls after loading offline pass |
| Runtime | No browser console/page errors in checked flows |

## Production performance

Chromium 153.0.8010.0, built app served by local Vite preview, 3 cache-disabled loads
per profile in a reused browser process. Desktop: 1365×1000, native CPU, no artificial
network delay. Mobile: 390×844, 4× CPU slowdown, 150ms latency, 1.6Mbps download,
750kbps upload. CDP confirms gzip responses without disk-cache or service-worker hits.
Resource Timing API byte fields were unavailable (zero) in this runtime; wire bytes
were independently obtained from CDP loadingFinished events instead.

| Metric | Desktop | Simulated mobile |
| --- | --- | --- |
| FCP, median | 72ms | 960ms |
| FCP, range | 56–164ms | 936–1040ms |
| LCP, median | 72ms | 960ms |
| LCP, range | 56–164ms | 936–1040ms |
| Maximum CLS across runs, including tested interactions | 0 | 0.00487 |
| Maximum measured interaction Event Timing duration | 32ms | 112ms |
| Maximum click to second animation frame | 29.4ms | 110.4ms |
| Longest observed main-thread long task | None above 50ms | 92ms, during interaction |

No initial-load long tasks above 50ms were observed in these six runs. Interaction
measurements cover opening What If, editing fields, Preview, Apply, and Undo. Event
Timing values are synthetic event durations, **not a field INP score**. Click-to-second
frame is a separate diagnostic and is not an INP substitute. LCP equals FCP in these
renders; no later remote font/image loads are present.

Vite reports JS 278.55kB raw / 84.23kB gzip; CSS 22.09kB raw / 5.59kB gzip;
HTML 0.54kB raw / 0.35kB gzip. The measured local HTTP responses were 83,815 bytes
for gzip JS, 5,924 bytes for gzip CSS, and 791 bytes for HTML, including response
headers. Compression settings therefore differ slightly from Vite's gzip estimate.
Run measurements are included in PERFORMANCE_RESULTS.json.

## Remaining limitations

- Browser coverage is Chromium only, with emulated mobile dimensions/CPU/network;
  no physical phone, Safari, or Firefox was exercised.
- Performance is local lab evidence, not a Lighthouse score, deployed HTTPS/CDN
  benchmark, real-device test, or field Core Web Vitals report. Browser process reuse
  can retain warmed compilation/runtime behavior despite disabled HTTP caching.
- No manual screen-reader session was performed. Axe and browser keyboard/semantics
  checks do not prove universal accessibility.
- Native OS date-picker/calendar popup focus was not automated. The app has no custom
  dialogs; native HTML field validation and focus were tested.
- npm audit checks known advisories at the time of execution; zero findings are not
  a guarantee of security. This was not a penetration test or third-party code audit.
- Performance cases use sample data and a decision, not the maximum permitted saved
  payload. Extremely large histories were not performance-benchmarked.
- Offline controls work after assets load; a cold offline navigation has no service
  worker cache and is not supported. Public hosting/HTTPS remains outside these checks.
