# Project: Sweet Smile (Pastry & Bakery Manager) — v1.2

## Architecture
- **Type**: Standalone Vanilla ES6 Single Page Application (SPA) / Progressive Web App (PWA) with native Android WebView wrapper.
- **Frontend Core**: ES6 native modules (`js/app.js`, `js/store.js`, `js/models.js`, `js/views/*.js`, `js/ui-feedback.js`), Tailwind CSS, Google Material Symbols Outlined.
- **UI Feedback & Dialog Engine**: `js/ui-feedback.js` providing non-blocking animated Toasts (`uiToast`) and Promise-based accessible dialogs (`uiModal`: alert, confirm, prompt, form dialogs), with dual-layer native suppression (JS monkey-patch + Android `WebChromeClient` overrides) eliminating all "file://" popups.
- **Accounting & Costing Engine**: `js/store.js` and `js/models.js` managing full financial lifecycle:
  - Total Sales ($\sum \text{invoices.total}$)
  - Cost of Goods Sold ($\sum \text{item.quantity} \times \text{item.cost}$)
  - Operating Expenses ($\sum \text{expenses.amount}$)
  - Gross Profit ($\text{Sales} - \text{COGS}$) and Gross Margin % ($(\text{Gross Profit} / \text{Sales}) \times 100$)
  - Net Profit ($\text{Gross Profit} - \text{Expenses}$) and Net Margin % ($(\text{Net Profit} / \text{Sales}) \times 100$)
- **Data Persistence**: Offline-first dual persistence in `localStorage` (`sweet_smile_app_state_v1`) and IndexedDB (`SweetSmileDB` in `js/db.js`), mirrored to offline mutation queue in `js/google-sync.js`.
- **Dynamic Charting**: Pure SVG/DOM reactive charting engine in `js/views/dashboardView.js` (7-day comparative grouped bar chart for Sales vs Expenses vs Profit, categorical expense distribution bar, dual gross/net margin gauges), updating dynamically upon store events.
- **Packaging & Build**: `build_apk.py` (mirrors `root/` web assets to `android_project/assets/`, compiles with AAPT2, javac, R8, apksigner into `SweetSmilePastry_v1.0.apk`).
- **Version Control**: Git branch `app-v1.2` tracking remote `https://github.com/Pocatox/Sweet-Smile-app` (alias `Pocapox/Sweet-Smile-app`).

## Code Layout
```
C:\Users\AMD\Desktop\My App\
├── index.html                 # Main administration PWA interface (Toast container & modal roots)
├── catalog.html               # Public customer-facing catalog with WhatsApp order checkout
├── manifest.json              # PWA manifest
├── sw.js                      # Service Worker offline asset cache
├── css/
│   └── styles.css             # Custom utility styles, toast animations, SVG chart styling
├── js/
│   ├── app.js                 # Router, top header, bottom bar, modal wiring, global sync events
│   ├── costing.js             # Recipe costing, margins, and suggested pricing
│   ├── db.js                  # IndexedDB persistent storage engine (SweetSmileDB)
│   ├── gemini-api.js          # Google Gemini API client with model fallback
│   ├── google-sync.js         # Google Drive / Cloud sync manager with offline mutation queue
│   ├── models.js              # Data schemas & initial seeds (products, inventory, recipes, invoices, expenses)
│   ├── notifications.js       # Web Audio & push notifications, baking timers
│   ├── ocr-ai.js              # Recipe OCR & social media importer adapter
│   ├── pdf-export.js          # A4 technical recipe sheet generator
│   ├── qr-generator.js        # Catalog QR code generator
│   ├── store.js               # Reactive state store & event dispatcher (expenses CRUD, invoices, inventory)
│   ├── ui-feedback.js         # Modern Toast & Modal system (replaces native dialogs)
│   └── views/
│       ├── catalogShareView.js # Web catalog QR generator & WhatsApp configuration
│       ├── chefAIView.js       # Chef IA assistant chat & inventory advice
│       ├── dashboardView.js    # Financial metrics, gross/net margins, expenses ledger, dynamic SVG charts
│       ├── inventoryView.js    # Pantry raw supplies & stock alerts
│       ├── posView.js          # Point of Sale & sales invoice records
│       └── recipesView.js      # Recipe catalog, costing slider, ingredients
├── tests/                     # Test harness and automated test runners
│   ├── e2e_runner.js          # E2E test runner (Node.js compatible)
│   ├── test_tier1.js          # Tier 1 Feature Coverage tests (including v1.2 R1-R4)
│   ├── test_tier2.js          # Tier 2 Boundary & Corner cases
│   ├── test_tier3.js          # Tier 3 Cross-feature combination tests
│   ├── test_tier4.js          # Tier 4 Real-world application scenarios
│   └── test_v12_accounting_ui.js # Dedicated v1.2 test suite for modals, expenses, charts, git
├── android_project/           # Android WebView native application wrapper
│   └── src/com/sweetsmile/pastry/MainActivity.java # WebChromeClient alert/prompt suppression
├── build_apk.py               # Android APK build script
└── .gitignore                 # Git ignore rules for heavy binaries & build artifacts
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Modern Toast Notification Engine | Typed non-blocking toasts (success, error, info, warning) with auto-dismiss and close action | M1_v12 | Survey / R1 |
| F2 | Promise-based Dialog Modals | Asynchronous accessible modal dialogs for confirm, prompt, and critical alerts | M1_v12 | Survey / R1 |
| F3 | Native Dialog Interception & Suppression | Global monkey-patch in JS + WebChromeClient override in Android to eliminate "file://" popups | M1_v12 | Survey / R1 |
| F4 | Dedicated Multi-Field In-App Modals | In-app modal forms for supply entry, recipe ingredients, baking timer, and expense creation | M1_v12 | Survey / R1 |
| F5 | Expense Data Model & Seed | Schema definition and initial seed for bakery expenses (amount, concept, category, date, etc.) | M2_v12 | Survey / R2 |
| F6 | Expense Reactive Store & CRUD | `store.saveExpense()`, `getExpenses()`, `deleteExpense()`, `invoices_changed`/`expenses_changed` events | M2_v12 | Survey / R2 |
| F7 | Dual Persistence for Expenses | Seamless persistence to `localStorage` and `IndexedDB` (`SweetSmileDB`) with offline sync | M2_v12 | Survey / R2 |
| F8 | Complete Financial & Margin Engine | Exact accounting for Total Sales, COGS, Total Expenses, Gross Profit, Gross Margin %, Net Profit, Net Margin % | M2_v12 | Survey / R2 |
| F9 | Expense Registration UI & Ledger | In-app `#expenseModal` registration form and dynamic Expense Ledger table with category/period filtering | M2_v12 | Survey / R2 |
| F10 | Dynamic SVG 7-Day Trend Chart | Offline-first 7-day comparative grouped bar chart for Sales vs Expenses vs Profit with tooltips | M3_v12 | Survey / R3 |
| F11 | Dynamic Categorical Expense Breakdown | Visual segmented progress bar / breakdown reflecting real expense distribution by category | M3_v12 | Survey / R3 |
| F12 | Dual Margin Gauge Visuals | Visual meters/gauges comparing Margen Bruto vs Margen Neto with target health indicators | M3_v12 | Survey / R3 |
| F13 | Chart Reactivity & Event Dispatch | Instant re-render of financial charts upon invoice creation or expense addition without memory leaks | M3_v12 | Survey / R3 |
| F14 | Comprehensive E2E Test Suite v1.2 | Automated test suite validating R1, R2, R3, R4 across all tiers without regressions | M4_v12 | Acceptance / R1-R4 |
| F15 | Adversarial Hardening & Forensic Audit | Stress testing edge cases (division by zero, negative margins, rapid events) and integrity audit | M4_v12 | Acceptance / Audit |
| F16 | Git Branch `app-v1.2` Creation & Release | Branch `app-v1.2` created, full changes committed, and pushed to remote `Pocatox`/`Pocapox` | M5_v12 | Survey / R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1_v12 | UI Modernization: Toasts & Modals (R1) | F1, F2, F3, F4 (js/ui-feedback.js, index.html modal containers, replace 36 native calls, MainActivity.java WebChromeClient overrides) | none | DONE (Gate PASS: 2 Reviewers APPROVE, 2 Challengers CONFIRMED, Auditor CLEAN, 230 tests PASS) |
| M2_v12 | Expense Tracking & Accounting Engine (R2) | F5, F6, F7, F8, F9 (models.js, store.js expenses CRUD, db.js IndexedDB, gross & net margins, #expenseModal, ledger table) | none | DONE (Gate PASS: 2 Reviewers APPROVE, 2 Challengers CONFIRMED, Auditor CLEAN, 297+ tests PASS) |
| M3_v12 | Dynamic Financial Charts & Reactivity (R3) | F10, F11, F12, F13 (dashboardView.js pure SVG 7-day bar chart, expense breakdown, margin gauges, store.subscribe reactivity) | M2_v12 | DONE (Gate PASS: Reviewer APPROVE, Auditor CLEAN, 343 tests PASS, route hijacking remediated) |
| M4_v12 | E2E Verification & Adversarial Hardening | F14, F15 (Tiers 1-5 test execution, test_v12_comprehensive_e2e.js, APK build verification) | M1_v12, M2_v12, M3_v12 | DONE (Gate PASS: 2 Reviewers APPROVE, 2 Challengers CONFIRMED, Auditor CLEAN, 281/281 tests PASS, APK v1/v2/v3 verified) |
| M5_v12 | Git Release: Branch `app-v1.2` & Push (R4) | F16 (git checkout -b app-v1.2, git commit, git push origin app-v1.2 to Pocatox/Pocapox repository) | M4_v12 | DONE (Branch app-v1.2 created, clean commit, pushed to GitHub remote, 281 tests PASS) |

## Interface Contracts

### `js/ui-feedback.js` ↔ Application Views
- `uiToast.show({ message: string, type: 'success'|'error'|'info'|'warning', duration?: number })`:
  - Renders an accessible, non-blocking floating toast in `#toastContainer`.
  - Auto-dismisses with CSS transition, includes dismiss button, updates `window._lastAlert` for test parity.
- `uiModal.confirm({ title: string, message: string, confirmText?: string, cancelText?: string, type?: 'danger'|'primary' }) => Promise<boolean>`:
  - Displays modal, resolves true on confirm button click, false on cancel/backdrop/escape.
- `uiModal.prompt({ title: string, message: string, defaultValue?: string, placeholder?: string, inputType?: string }) => Promise<string|null>`:
  - Displays modal with input field, resolves with input string on confirm, null on cancel.
- `uiModal.alert({ title: string, message: string, type?: string }) => Promise<void>`:
  - Replaces blocking alert with accessible modal dialog.

### `js/store.js` ↔ Expenses & Accounting
- `store.getExpenses(filter?: { category?: string, startDate?: string, endDate?: string }) => Expense[]`
- `store.saveExpense(expenseData: Partial<Expense>) => Expense`:
  - Validates `amount > 0`, `concept`, `category`, generates ID (`EXP-XXXXX`), ISO date.
  - Prepends to `store.state.expenses`.
  - Saves to localStorage and triggers IndexedDB persistence.
  - Emits `expenses_changed` and `state_changed`.
- `store.deleteExpense(id: string) => boolean`:
  - Removes expense by id, saves state, emits `expenses_changed`.
- `store.getFinancialSummary() => { totalSales, totalCogs, totalExpenses, totalCosts, grossProfit, grossMargin, netProfit, netMargin }`:
  - Performs pure, exact calculations with 0-division guards.

### `js/views/dashboardView.js` ↔ Dynamic Charts
- `#chartWeekTrend`:
  - Pure SVG responsive container containing grouped bars: Green for Sales, Red/Orange for Expenses, Blue/Purple for Net Profit per day.
  - Interactive tooltip showing exact formatted currency on hover/click.
- `#expenseBreakdownBar`:
  - Segmented visual bar dynamically sized proportionally to each category's total expenses.
- `#marginGaugeContainer`:
  - Visual dual gauge displaying Gross Margin % and Net Margin % with status badges.
- Store subscription:
  - Subscribes to `invoices_changed` and `expenses_changed`.
  - Automatically unbinds if `#dashboardView` is detached from DOM.
