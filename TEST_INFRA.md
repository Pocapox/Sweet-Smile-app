# TEST_INFRA.md — Sweet Smile Pastry Testing Infrastructure

## 1. Overview & Strategy

The Sweet Smile Pastry & Bakery Manager application is a vanilla ES6 Single Page Application (SPA) designed with an offline-first architecture for web and mobile (Android WebView).

To ensure complete verification without requiring heavy external dependencies (such as Chrome/Puppeteer or npm packages), the test harness utilizes a **Node.js native test runner and DOM virtualization engine**. It runs directly under **Node.js v26+** and executes opaque-box, requirement-driven tests covering 100% of functional requirements (R1–R7) and features (F1–F17).

```
                      ┌───────────────────────────────────────┐
                      │          tests/e2e_runner.js          │
                      │       CLI Runner & Summary Engine     │
                      └──────────────────┬────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
      ┌──────────▼──────────┐                         ┌──────────▼──────────┐
      │   tests/harness.js  │                         │    Test Suites      │
      │   - Mock DOM        │                         │  - test_tier1.js    │
      │   - Mock Storage    │                         │  - test_tier2.js    │
      │   - Mock IndexedDB  │                         │  - test_tier3.js    │
      │   - Mock Network    │                         │  - test_tier4.js    │
      │   - Assertions      │                         └─────────────────────┘
      └─────────────────────┘
```

---

## 2. 4-Tier Test Methodology

The test suite is structured into four distinct verification tiers:

### Tier 1: Feature Coverage (Unit & Interface Contracts)
- **Scope**: Every feature F1 through F17 is validated with at least **5 distinct test cases** exercising happy paths and primary inputs.
- **Minimum Target**: 17 features × ≥5 cases = **≥85 test cases**.
- **File**: `tests/test_tier1.js`

### Tier 2: Boundary & Corner Cases (Stress & Resilience)
- **Scope**: Edge cases, limits, zero-quantities, empty strings, maximum numbers, special characters, and adversarial/injection payloads for each feature F1 through F17 (≥5 cases per feature).
- **Minimum Target**: 17 features × ≥5 cases = **≥85 test cases**.
- **File**: `tests/test_tier2.js`

### Tier 3: Cross-Feature Combinations (Integration Workflows)
- **Scope**: Pairwise and multi-module interactions across system boundaries:
  - POS sale execution → Multi-tier stock decrement (product + raw ingredients) → Dashboard KPI recalculation.
  - Social media URL parsing → Recipe catalog registration → Recipe costing margins → Suggested pricing.
  - OCR recipe photo scan → Ingredient pantry mapping → Automatic product creation.
  - Gemini API client model fallback (`gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-1.5-flash`) on network error.
  - Google Cloud sync offline queuing → Online reconnect trigger → Cloud sync resolution.
  - In-app QR poster modal interaction → Safe print trigger → Navigation integrity.
- **Minimum Target**: **≥10 integration test cases**.
- **File**: `tests/test_tier3.js`

### Tier 4: Real-World Application Scenarios (End-to-End Bakery Operations)
- **Scope**: Multi-step realistic scenarios modeling daily bakery operations from start to finish:
  - Scenario 1: Morning inventory inspection and low-stock alert review.
  - Scenario 2: Peak rush hour POS transactions with mixed payment methods, discounts, and tips.
  - Scenario 3: Creating a new product from an OCR-scanned recipe card.
  - Scenario 4: Ingesting a viral TikTok recipe and adding it to the seasonal menu.
  - Scenario 5: Customer QR code poster generation and WhatsApp order link simulation.
  - Scenario 6: Kitchen oven timer creation, notification alerts, and expiration warnings.
  - Scenario 7: Chef IA consultation and price adjustment following butter cost inflation.
  - Scenario 8: Raw pantry restocking from supplier delivery and stock alert clearance.
  - Scenario 9: End-of-day financial reconciliation and net margin audit.
  - Scenario 10: Complete disaster recovery: state backup export, storage wipe, and state restore.
- **Minimum Target**: **≥10 end-to-end scenarios**.
- **File**: `tests/test_tier4.js`

**Total Suite Target**: **≥190 automated test cases**.

---

## 3. Test Environment & Harness Architecture (`tests/harness.js`)

The test harness provides lightweight, deterministic shims for all Web APIs required by Sweet Smile:

1. **DOM Virtualization**:
   - `MockElement`: Implements `innerHTML`, `innerText`, `value`, `attributes`, `classList` (`add`, `remove`, `contains`, `toggle`), `addEventListener`, `dispatchEvent`, `click()`, `querySelector()`, `querySelectorAll()`, `appendChild()`, `remove()`.
   - `MockDocument`: Implements `createElement()`, `getElementById()`, `querySelector()`, `querySelectorAll()`, `body`.
   - `MockWindow`: Implements event listeners (`online`, `offline`, `keydown`), `location` (`origin`, `pathname`, `hash`), `open()`, `print()`, `alert()`, `confirm()`.

2. **Storage Virtualization**:
   - `MockStorage`: In-memory `localStorage` with `getItem`, `setItem`, `removeItem`, `clear`, `key`, and `length`. Supports corruption simulation for fault tolerance tests.
   - `MockIndexedDB`: In-memory asynchronous key-value database mimicking IndexedDB transactions and object stores.

3. **Network & Fetch Virtualization**:
   - `MockFetch`: Intercepts outbound HTTP requests to Google Gemini REST endpoints and Google Cloud Sync endpoints with configurable responses, latency, and status codes (200, 400, 403, 429, 500).

4. **Assertion Library**:
   - `assert(condition, message)`
   - `assertEquals(actual, expected, message)`
   - `assertNotEquals(actual, unexpected, message)`
   - `assertDeepEquals(actual, expected, message)`
   - `assertTrue(value, message)`
   - `assertFalse(value, message)`
   - `assertNull(value, message)`
   - `assertNotNull(value, message)`
   - `assertContains(haystack, needle, message)`
   - `assertThrows(fn, expectedErrorRegex, message)`
   - `assertRejects(asyncFn, expectedErrorRegex, message)`
   - `assertCloseTo(actual, expected, delta, message)`

5. **Test Lifecycle Hooks**:
   - `describe(name, fn)`: Groups test cases into feature or scenario suites.
   - `test(name, asyncFn)`: Defines an isolated test case with automatic pass/fail tracking.
   - `beforeEach(fn)` / `afterEach(fn)`: Environment setup and tear-down hooks for complete test isolation.

---

## 4. Feature-to-Requirement Traceability Matrix

| Feature ID | Name | Requirement | Tier 1 Tests | Tier 2 Tests | Tier 3 Integration | Tier 4 Scenarios |
|---|---|---|---|---|---|---|
| **F1** | Offline-First Storage | R1 | 5+ | 5+ | Yes | Scenarios 6, 10 |
| **F2** | Google Cloud Sync | R1 | 5+ | 5+ | Yes | Scenario 6 |
| **F3** | Visible "Guardar Venta" Button | R2 | 5+ | 5+ | Yes | Scenario 2 |
| **F4** | Sales History & Invoices | R2 | 5+ | 5+ | Yes | Scenarios 2, 9 |
| **F5** | Multi-Tier Inventory Deduction | R2 | 5+ | 5+ | Yes | Scenarios 1, 2, 8 |
| **F6** | Recipe OCR Image Capture | R3 | 5+ | 5+ | Yes | Scenario 3 |
| **F7** | Multimodal Gemini OCR | R3 | 5+ | 5+ | Yes | Scenario 3 |
| **F8** | Social Media URL Ingestion | R4 | 5+ | 5+ | Yes | Scenario 4 |
| **F9** | Social Recipe Structuring | R4 | 5+ | 5+ | Yes | Scenario 4 |
| **F10** | Accessible QR Poster Modal | R5 | 5+ | 5+ | Yes | Scenario 5 |
| **F11** | Safe QR Poster Printing | R5 | 5+ | 5+ | Yes | Scenario 5 |
| **F12** | Gemini API Client & Fallbacks | R6 | 5+ | 5+ | Yes | Scenarios 3, 4, 7 |
| **F13** | Dynamic Chef IA Assistant | R6 | 5+ | 5+ | Yes | Scenarios 1, 7 |
| **F14** | Comprehensive E2E Runner | R7 | 5+ | 5+ | Yes | All Scenarios |
| **F15** | Adversarial Hardening | R7 | 5+ | 5+ | Yes | Stress Suite |
| **F16** | Clean .gitignore Configuration | R7 | 5+ | 5+ | Yes | Release Checklist |
| **F17** | GitHub Sync & Repo Readiness | R7 | 5+ | 5+ | Yes | Release Checklist |

---

## 5. Execution Instructions

### Run the Complete E2E Test Suite
```bash
node tests/e2e_runner.js
```

### Run a Specific Tier
```bash
# Tier 1 only (Feature Coverage)
node tests/e2e_runner.js --tier=1

# Tier 2 only (Boundary & Corner Cases)
node tests/e2e_runner.js --tier=2

# Tier 3 only (Cross-Feature Integrations)
node tests/e2e_runner.js --tier=3

# Tier 4 only (Real-World Scenarios)
node tests/e2e_runner.js --tier=4
```

### Run with Filter Pattern
```bash
# Filter tests matching a feature name or keyword
node tests/e2e_runner.js --filter=F3
node tests/e2e_runner.js --filter="POS"
node tests/e2e_runner.js --filter="Gemini"
```

### Verbose Mode
```bash
node tests/e2e_runner.js --verbose
```

---

## 6. Exit Codes & Reporting

- **Exit 0**: All executed test cases passed successfully.
- **Exit 1**: One or more assertions failed or unexpected exceptions were raised.

Upon execution completion, the runner displays:
- Suite summary table with counts of passed, failed, and total tests per tier.
- Assertion counts.
- Total execution time in milliseconds.
- Stack traces for any failures with exact file and line numbers.
