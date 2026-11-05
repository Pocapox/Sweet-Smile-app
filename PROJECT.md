# Project: Sweet Smile (Pastry & Bakery Manager)

## Architecture
- **Type**: Standalone Vanilla ES6 Single Page Application (SPA) / Progressive Web App (PWA) with native Android WebView wrapper.
- **Frontend Core**: ES6 native modules (`js/app.js`, `js/store.js`, `js/models.js`, `js/views/*.js`), Tailwind CSS via CDN, Google Material Symbols Outlined.
- **Packaging & Build**: `build_apk.py` (mirrors `root/` web assets to `android_project/assets/`, compiles with AAPT2, javac, R8, apksigner into `SweetSmilePastry_v1.0.apk`).
- **Data Flow & State**:
  - `store.js` is the central reactive state store holding `products`, `inventory`, `recipes`, `invoices`, `settings`.
  - Offline-first local persistence: synchronizes changes to `localStorage` / `IndexedDB`.
  - Cloud synchronization: `google-sync.js` handles Google cloud backup/sync with offline queue and timestamped conflict resolution.
  - External AI: `gemini-api.js` provides REST client for Google Gemini (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`) for Chef IA, OCR vision, and social media recipe extraction.

## Code Layout
```
C:\Users\AMD\Desktop\My App\
├── index.html                 # Main administration PWA interface
├── catalog.html               # Public customer-facing catalog with WhatsApp order checkout
├── manifest.json              # PWA manifest
├── sw.js                      # Service Worker offline asset cache
├── css/
│   └── styles.css             # Custom utility styles and animations
├── js/
│   ├── app.js                 # Router, top header, bottom bar, modal wiring
│   ├── costing.js             # Recipe costing, margins, and suggested pricing
│   ├── db.js                  # IndexedDB persistent storage engine
│   ├── gemini-api.js          # Google Gemini API client with model fallback
│   ├── google-sync.js         # Google Drive / Cloud sync manager
│   ├── models.js              # Data schemas and initial seed datasets
│   ├── notifications.js       # Web Audio & push notifications, baking timers
│   ├── ocr-ai.js              # Recipe OCR & social media importer adapter
│   ├── pdf-export.js          # A4 technical recipe sheet generator
│   ├── qr-generator.js        # Catalog QR code generator
│   ├── store.js               # Reactive state store & event dispatcher
│   └── views/
│       ├── catalogShareView.js # Web catalog QR generator & WhatsApp configuration
│       ├── chefAIView.js       # Chef IA assistant chat & inventory advice
│       ├── dashboardView.js    # Financial metrics, net profit, orders, charts
│       ├── inventoryView.js    # Pantry raw supplies & stock alerts
│       ├── posView.js          # Point of Sale & sales invoice records
│       └── recipesView.js      # Recipe catalog, costing slider, ingredients
├── tests/                     # Test harness and automated test runners
│   ├── e2e_runner.js          # E2E test runner (Node.js compatible)
│   ├── test_tier1.js          # Tier 1 Feature Coverage tests
│   ├── test_tier2.js          # Tier 2 Boundary & Corner cases
│   ├── test_tier3.js          # Tier 3 Cross-feature combination tests
│   └── test_tier4.js          # Tier 4 Real-world application scenarios
├── android_project/           # Android WebView native application wrapper
├── build_apk.py               # Android APK build script
└── .gitignore                 # Git ignore rules for heavy binaries & build artifacts
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Offline-first local storage | Robust local storage (localStorage + IndexedDB fallback) | M1 | Survey / R1 |
| F2 | Google synchronization | Google cloud sync service, online/offline queue, sync modal | M1 | Survey / R1 |
| F3 | Visible "Guardar Venta" button | Prominent save button in POS view & cart modal | M2 | Survey / R2 |
| F4 | Sales transaction history & KPIs | Save sales to invoices, update history and dashboard metrics | M2 | Survey / R2 |
| F5 | Multi-tier inventory deduction | Decrement product stock AND raw recipe ingredients in pantry | M2 | Survey / R2 |
| F6 | Recipe OCR image capture | Camera and file picker input for recipe photo capture | M4 | Survey / R3 |
| F7 | Multimodal Gemini OCR | Extract recipe name, yield, ingredients, costs, steps via Gemini | M4 | Survey / R3 |
| F8 | Social media URL ingestion | Input and validation for TikTok, Instagram, YouTube Shorts | M4 | Survey / R4 |
| F9 | Social recipe structuring | Parse oEmbed metadata + Gemini pastry recipe reconstruction | M4 | Survey / R4 |
| F10 | Accessible QR poster modal | In-app modal with close X, cancel button, backdrop, Escape key | M3 | Survey / R5 |
| F11 | Safe QR poster printing | Non-destructive printing without trapping navigation | M3 | Survey / R5 |
| F12 | Google Gemini API client | REST client with model fallback and API key settings UI | M4 | Survey / R6 |
| F13 | Dynamic Chef IA Assistant | Real-time pastry chef chat with inventory & recipe context | M4 | Survey / R6 |
| F14 | Comprehensive E2E test suite | Automated tests covering Tiers 1-4 for 100% of requirements | M5 | Survey / Acceptance |
| F15 | Adversarial coverage hardening | Tier 5 adversarial stress testing and defect resolution | M5 | Survey / Acceptance |
| F16 | Clean .gitignore configuration | Exclude android_tools/ (49MB), APKs, and temporary files | M6 | Survey / R7 |
| F17 | GitHub repository synchronization | Push all commits and code to remote Pocapox/Sweet-Smile-app | M6 | Survey / R7 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Storage & Google Sync | F1, F2 (IndexedDB/localStorage resilience, GoogleSyncManager, sync UI) | none | DONE (Verified: IndexedDB db.js + GoogleSyncManager google-sync.js, 67/67 tests passed) |
| M2 | POS Sales & Inventory Impact | F3, F4, F5 ("Guardar Venta" button, store.saveInvoice, recipe ingredient deduction) | none | DONE (Remediated: store.js culinary qualifiers & substantive token matching, 22/22 empirical challenge passed) |
| M3 | QR Poster Dialog & Navigation | F10, F11 (In-app #qrPosterModal, close/cancel/backdrop/escape controls, safe print) | none | DONE (Gate PASS: 2 Reviewers APPROVE, 2 Challengers CONFIRMED, Auditor CLEAN) |
| M4 | Google Gemini Suite (Chef IA, OCR, Social) | F6, F7, F8, F9, F12, F13 (Gemini API client, Chef IA chat, OCR camera, Social import) | M1 | DONE (Verified: GeminiAPI, Chef IA live chat, Vision OCR, Social import) |
| M5 | Final E2E Test Suite & Adversarial Hardening | F14, F15 (Pass 100% E2E test suite published by test track, Tier 5 hardening) | M1, M2, M3, M4 | DONE (Gate PASS: 230/230 tests passed, Tier 5 40/40 CONFIRMED, Auditor CLEAN) |
| M6 | GitHub Synchronization | F16, F17 (Setup .gitignore, git init, add remote, commit and push to GitHub) | M5 | IN_PROGRESS (Worker: d18ef1f8-0dfd-42bd-84dd-a8cc54cb5bd9) |

## Interface Contracts

### `store.js` ↔ `views/posView.js`
- `store.saveInvoice(invoiceData)`:
  - Input: `{ type: "ticket"|"factura", customerName: string, customerDoc: string, items: Array<{productId, name, quantity, price, total}>, subtotal, discountPercent, discountAmount, tip, total, paymentMethod: string, status: "Pagada" }`
  - Side effects:
    1. Prepend invoice with generated ID (`TIK-XXXXX` or `FAC-XXXXX`) and ISO date.
    2. Decrement `prod.stock` for each item.
    3. If product has `recipeId`, look up recipe and for each ingredient: decrement matching item in `store.state.inventory` by `(ingredient.quantity * item.quantity)` and update status (`optimal`, `warning`, `critical`).
    4. Save state to localStorage / IndexedDB.
    5. Emit `invoices_changed` and `inventory_changed` events.
  - Return: Saved invoice object.

### `catalogShareView.js` ↔ DOM Modal
- `#qrPosterModal`:
  - Opening: `#btnPrintQrPoster` removes `hidden` class from `#qrPosterModal`.
  - Closing: `#closeQrPosterModal`, `#btnCancelQrPoster`, backdrop click, or `Escape` key adds `hidden` class.
  - Printing: `#btnExecutePrintPoster` triggers print without navigation loss.

### `gemini-api.js` ↔ `ocr-ai.js` / `chefAIView.js`
- `GeminiAPI.generateContent(prompt, options = {})`:
  - Options: `{ imageBase64: string, mimeType: string, temperature: number, systemInstruction: string, jsonResponse: boolean }`
  - Fallback models: `["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]`
  - Returns: String response or parsed JSON object if `jsonResponse: true`.
- `GeminiAPI.getApiKey()`:
  - Resolution order: `window.GEMINI_API_KEY` -> `store.getSettings().geminiApiKey` -> `localStorage.getItem("sweet_smile_gemini_key")`.

### `google-sync.js` ↔ `store.js`
- `GoogleSyncManager`:
  - Methods: `init()`, `syncNow()`, `getStatus()`, `exportBackup()`, `importBackup(jsonString)`
  - Events emitted: `sync_status_changed` (`{ status: "idle"|"syncing"|"synced"|"offline"|"error", lastSync: string, error?: string }`)
