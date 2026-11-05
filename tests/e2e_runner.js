#!/usr/bin/env node
// tests/e2e_runner.js - Sweet Smile Pastry Master E2E Test Runner
import { collector, resetGlobalEnv } from './harness.js';

// ANSI styling
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';

// CLI argument parsing
const args = process.argv.slice(2);
let tierFilter = null;
let nameFilter = null;
let verbose = false;

for (const arg of args) {
  if (arg.startsWith('--tier=')) {
    tierFilter = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--filter=')) {
    nameFilter = arg.split('=')[1].toLowerCase();
  } else if (arg === '--verbose' || arg === '-v') {
    verbose = true;
  }
}

async function run() {
  console.log(`${BOLD}${CYAN}==============================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   🍰 SWEET SMILE PASTRY — 4-TIER E2E TEST RUNNER${RESET}`);
  console.log(`${BOLD}${CYAN}==============================================================${RESET}`);
  if (tierFilter) console.log(`${DIM}Filter: Tier ${tierFilter}${RESET}`);
  if (nameFilter) console.log(`${DIM}Filter: Name contains "${nameFilter}"${RESET}`);
  console.log();

  const tierFiles = [
    { tier: 1, name: 'Tier 1: Feature Coverage (F1–F17)', path: './test_tier1.js' },
    { tier: 2, name: 'Tier 2: Boundary & Corner Cases (F1–F17)', path: './test_tier2.js' },
    { tier: 3, name: 'Tier 3: Cross-Feature Integration Workflows', path: './test_tier3.js' },
    { tier: 4, name: 'Tier 4: Real-World Bakery Scenarios', path: './test_tier4.js' },
    { tier: 5, name: 'Tier 5: Adversarial Stress Hardening', path: './test_tier5_adversarial.js', optional: true }
  ];

  const results = [];
  const startTime = Date.now();

  for (const tf of tierFiles) {
    if (tf.optional && tierFilter !== tf.tier && !args.includes('--all')) continue;
    if (tierFilter && tf.tier !== tierFilter) continue;

    console.log(`${BOLD}▶ Executing ${tf.name}...${RESET}`);
    collector.clear();

    try {
      // Dynamic import of tier suite
      await import(`${tf.path}?t=${Date.now()}`);
    } catch (err) {
      console.error(`${RED}Failed to load test suite ${tf.path}:${RESET}`, err);
      results.push({
        tier: tf.tier,
        name: tf.name,
        passed: 0,
        failed: 1,
        total: 1,
        failures: [{ name: `Load ${tf.path}`, error: err }]
      });
      continue;
    }

    const tierResult = await executeCollectedSuites(collector.suites, nameFilter, verbose);
    results.push({
      tier: tf.tier,
      name: tf.name,
      ...tierResult
    });
    console.log();
  }

  const totalDuration = Date.now() - startTime;
  printSummaryTable(results, totalDuration);

  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

async function executeCollectedSuites(suites, filter, verbose) {
  let passed = 0;
  let failed = 0;
  const failures = [];

  async function runSuite(suite, parentHooks = { beforeEach: [], afterEach: [] }) {
    const currentBefore = [...parentHooks.beforeEach, ...suite.beforeEachHooks];
    const currentAfter = [...suite.afterEachHooks, ...parentHooks.afterEach];

    if (verbose) {
      console.log(`  ${BOLD}${suite.name}${RESET}`);
    }

    for (const test of suite.tests) {
      if (filter && !test.name.toLowerCase().includes(filter) && !suite.name.toLowerCase().includes(filter)) {
        continue;
      }

      resetGlobalEnv();

      // Run beforeEach hooks
      let hookFailed = false;
      for (const bh of currentBefore) {
        try {
          await bh();
        } catch (err) {
          hookFailed = true;
          failed++;
          failures.push({ name: `${suite.name} > ${test.name} (beforeEach)`, error: err });
          console.log(`  ${RED}✗ [FAIL]${RESET} ${suite.name} > ${test.name} (beforeEach failed: ${err.message})`);
          break;
        }
      }
      if (hookFailed) continue;

      const t0 = Date.now();
      try {
        await test.fn();
        const dt = Date.now() - t0;
        passed++;
        if (verbose) {
          console.log(`    ${GREEN}✓${RESET} ${test.name} ${DIM}(${dt}ms)${RESET}`);
        }
      } catch (err) {
        const dt = Date.now() - t0;
        failed++;
        failures.push({ name: `${suite.name} > ${test.name}`, error: err });
        console.log(`  ${RED}✗ [FAIL]${RESET} ${suite.name} > ${test.name} ${DIM}(${dt}ms)${RESET}`);
        console.log(`    ${RED}${err.message}${RESET}`);
        if (verbose && err.stack) {
          console.log(`    ${DIM}${err.stack.split('\n').slice(1, 4).join('\n    ')}${RESET}`);
        }
      }

      // Run afterEach hooks
      for (const ah of currentAfter) {
        try {
          await ah();
        } catch (err) {
          console.error(`Error in afterEach hook:`, err);
        }
      }
    }

    if (suite.suites) {
      for (const childSuite of suite.suites) {
        await runSuite(childSuite, { beforeEach: currentBefore, afterEach: currentAfter });
      }
    }
  }

  for (const s of suites) {
    await runSuite(s);
  }

  const total = passed + failed;
  const statusColor = failed === 0 ? GREEN : RED;
  console.log(`  ${statusColor}Result: ${passed}/${total} passed (${failed} failed)${RESET}`);

  return { passed, failed, total, failures };
}

function printSummaryTable(results, durationMs) {
  console.log(`${BOLD}${CYAN}==============================================================${RESET}`);
  console.log(`${BOLD}${CYAN}                     TEST SUITE SUMMARY                       ${RESET}`);
  console.log(`${BOLD}${CYAN}==============================================================${RESET}`);
  console.log(`| Tier / Suite                               | Pass | Fail | Total | Status |`);
  console.log(`|--------------------------------------------|------|------|-------|--------|`);

  let grandPassed = 0;
  let grandFailed = 0;
  let grandTotal = 0;

  for (const r of results) {
    grandPassed += r.passed;
    grandFailed += r.failed;
    grandTotal += r.total;
    const namePadded = r.name.padEnd(42).slice(0, 42);
    const passPadded = String(r.passed).padStart(4);
    const failPadded = String(r.failed).padStart(4);
    const totalPadded = String(r.total).padStart(5);
    const status = r.failed === 0 ? `${GREEN} PASS ${RESET}` : `${RED} FAIL ${RESET}`;

    console.log(`| ${namePadded} | ${passPadded} | ${failPadded} | ${totalPadded} | ${status} |`);
  }

  console.log(`|--------------------------------------------|------|------|-------|--------|`);
  const totalPassPad = String(grandPassed).padStart(4);
  const totalFailPad = String(grandFailed).padStart(4);
  const totalGrandPad = String(grandTotal).padStart(5);
  const overallStatus = grandFailed === 0 ? `${GREEN} PASS ${RESET}` : `${RED} FAIL ${RESET}`;
  console.log(`| ${BOLD}${'TOTAL'.padEnd(42)}${RESET} | ${BOLD}${totalPassPad}${RESET} | ${BOLD}${totalFailPad}${RESET} | ${BOLD}${totalGrandPad}${RESET} | ${BOLD}${overallStatus}${RESET} |`);
  console.log(`${BOLD}${CYAN}==============================================================${RESET}`);
  console.log(`Total tests run: ${BOLD}${grandTotal}${RESET} in ${durationMs}ms`);

  if (grandFailed > 0) {
    console.log();
    console.log(`${BOLD}${RED}Failures Summary (${grandFailed}):${RESET}`);
    let idx = 1;
    for (const r of results) {
      for (const f of r.failures) {
        console.log(`  ${idx++}. ${BOLD}${f.name}${RESET}: ${f.error.message}`);
      }
    }
    console.log();
  } else {
    console.log(`${BOLD}${GREEN}✔ All test cases passed successfully!${RESET}`);
  }
}

run().catch(err => {
  console.error(`${RED}Fatal runner error:${RESET}`, err);
  process.exit(1);
});
