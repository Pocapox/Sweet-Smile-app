// tests/test_m1_storage_sync.js - Rigorous Verification Suite for Milestone M1 (F1, F2)
import { setupGlobalEnv, mockStorage, mockIdb } from './harness.js';

// Setup headless browser environment
setupGlobalEnv();

import { initDB, saveToIndexedDB, loadFromIndexedDB, deleteFromIndexedDB, clearIndexedDB, closeDB, DB_NAME, STORE_NAME, isIndexedDBAvailable } from '../js/db.js';
import { GoogleSyncManager, googleSync } from '../js/google-sync.js';
import { store } from '../js/store.js';
import { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES } from '../js/models.js';

console.log('================================================================');
console.log('🧪 RUNNING MILESTONE M1 VERIFICATION: STORAGE RESILIENCE & SYNC');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, name, details = '') {
  if (condition) {
    passed++;
    console.log(`  ✔ PASS: ${name}`);
  } else {
    failed++;
    console.error(`  ✖ FAIL: ${name} - ${details}`);
  }
}

async function runTests() {
  // -------------------------------------------------------------
  // TEST GROUP 1: FEATURE F1 (INDEXEDDB STORAGE ENGINE)
  // -------------------------------------------------------------
  console.log('--- TEST GROUP 1: IndexedDB Storage Engine (js/db.js) ---');

  assert(DB_NAME === 'SweetSmileDB', 'DB_NAME must be "SweetSmileDB"');
  assert(STORE_NAME === 'state', 'STORE_NAME must be "state"');
  assert(isIndexedDBAvailable() === true, 'isIndexedDBAvailable should detect mockIdb');

  // F1-01: initDB initializes the database and returns the DB object
  const db = await initDB();
  assert(db !== null, 'initDB must return a valid database instance');
  assert(db.name === 'SweetSmileDB', 'Database name matches "SweetSmileDB"');
  assert(db.objectStoreNames.contains('state'), 'Database must contain object store "state"');

  // F1-02: saveToIndexedDB stores data persistently
  const testPayload = {
    testKey: 'test_value_123',
    productsCount: 42,
    timestamp: new Date().toISOString()
  };
  const saveSuccess = await saveToIndexedDB('app_state', testPayload);
  assert(saveSuccess === true, 'saveToIndexedDB must return true on success');

  // F1-03: loadFromIndexedDB retrieves previously saved data accurately
  const loaded = await loadFromIndexedDB('app_state');
  assert(loaded !== null, 'loadFromIndexedDB must return non-null result');
  assert(loaded.testKey === 'test_value_123', 'Stored property matches original value');
  assert(loaded.productsCount === 42, 'Numerical property matches original value');

  // F1-04: deleteFromIndexedDB removes specific key
  await saveToIndexedDB('temp_item', { msg: 'delete_me' });
  const beforeDelete = await loadFromIndexedDB('temp_item');
  assert(beforeDelete !== null, 'temp_item is stored before deletion');
  await deleteFromIndexedDB('temp_item');
  const afterDelete = await loadFromIndexedDB('temp_item');
  assert(afterDelete === null, 'temp_item is null after deleteFromIndexedDB');

  // F1-05: clearIndexedDB clears all entries
  await saveToIndexedDB('k1', 'val1');
  await saveToIndexedDB('k2', 'val2');
  await clearIndexedDB();
  const k1After = await loadFromIndexedDB('k1');
  assert(k1After === null, 'clearIndexedDB removes all entries from store');

  // F1-06: Headless Node safe handling when indexedDB is undefined
  const originalIndexedDB = globalThis.indexedDB;
  delete globalThis.indexedDB;
  assert(isIndexedDBAvailable() === false, 'isIndexedDBAvailable returns false when indexedDB is undefined');
  const fallbackInit = await initDB();
  assert(fallbackInit === null, 'initDB gracefully resolves null without throwing when indexedDB is missing');
  const fallbackSave = await saveToIndexedDB('any_key', { data: 1 });
  assert(fallbackSave === false, 'saveToIndexedDB gracefully resolves false when indexedDB is missing');
  const fallbackLoad = await loadFromIndexedDB('any_key');
  assert(fallbackLoad === null, 'loadFromIndexedDB gracefully resolves null when indexedDB is missing');
  // Restore mockIdb
  globalThis.indexedDB = originalIndexedDB;

  // -------------------------------------------------------------
  // TEST GROUP 2: FEATURE F2 (GOOGLE SYNC & OFFLINE MUTATION QUEUE)
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Google Sync & Mutation Queue (js/google-sync.js) ---');

  const syncMgr = new GoogleSyncManager(store);
  syncMgr.clearMutationQueue();

  // F2-01: Status tracking and live labels
  assert(typeof syncMgr.getStatus === 'function', 'getStatus is a function');
  const initialStatus = syncMgr.getStatus();
  assert(initialStatus.isOnline === true, 'Initial status reflects navigator.onLine true');
  assert(initialStatus.statusLabel === 'Sincronizado', 'Initial statusLabel is "Sincronizado"');

  // F2-02: Network offline transition
  syncMgr.handleNetworkChange(false);
  assert(syncMgr.getStatus().isOnline === false, 'handleNetworkChange(false) updates isOnline to false');
  assert(syncMgr.getStatus().statusLabel === 'Sin Conexión', 'Status label reflects "Sin Conexión" when offline');

  // F2-03: Queuing mutations when offline
  const mut1 = syncMgr.queueMutation({
    entity: 'products',
    action: 'update',
    item: { id: 'prod_99', name: 'Offline Empanada', price: 3.50 }
  });
  assert(mut1.id.startsWith('mut_'), 'Mutation entry has generated ID');
  assert(syncMgr.getPendingCount() === 1, 'Pending count is incremented to 1');
  const pendingList = syncMgr.getPendingMutations();
  assert(pendingList.length === 1 && pendingList[0].entity === 'products', 'getPendingMutations returns queued items');

  // F2-04: Network online transition with pending queue moves to "pending"
  syncMgr.handleNetworkChange(true);
  assert(syncMgr.getStatus().isOnline === true, 'isOnline is restored to true');
  assert(syncMgr.getStatus().status === 'pending', 'Status with queued mutations transitions to "pending"');
  assert(syncMgr.getStatus().statusLabel === 'Pendiente', 'Status label reflects "Pendiente"');

  // F2-05: syncNow() executes synchronization, flushes queue, and updates status to synced
  let statusChangedEvt = null;
  let lastSyncEvt = null;
  syncMgr.subscribe((evt, data) => {
    if (evt === 'sync_status_changed') statusChangedEvt = data;
    if (evt === 'last_sync_updated') lastSyncEvt = data;
  });

  const syncResult = await syncMgr.syncNow();
  assert(syncResult.success === true, 'syncNow() returns success: true');
  assert(syncMgr.getPendingCount() === 0, 'syncNow() flushes offline mutation queue');
  assert(syncMgr.getStatus().status === 'synced', 'syncNow() sets status to "synced"');
  assert(syncMgr.getStatus().statusLabel === 'Sincronizado', 'Status label becomes "Sincronizado"');
  assert(statusChangedEvt !== null && statusChangedEvt.status === 'synced', 'sync_status_changed event is dispatched');
  assert(lastSyncEvt !== null && typeof lastSyncEvt.lastSync === 'string', 'last_sync_updated event is dispatched');

  // F2-06: syncNow() refuses gracefully when offline
  syncMgr.handleNetworkChange(false);
  const offlineSync = await syncMgr.syncNow();
  assert(offlineSync.success === false, 'syncNow() returns success: false when offline');
  assert(offlineSync.reason === 'offline', 'syncNow() returns reason: "offline"');
  syncMgr.handleNetworkChange(true);

  // F2-07: Last-Write-Wins (LWW) conflict resolution logic
  const localItems = [
    { id: 'item_1', name: 'Local Old Cake', updatedAt: '2026-11-01T10:00:00Z', price: 10.00 },
    { id: 'item_2', name: 'Local Newer Cookie', updatedAt: '2026-11-03T10:00:00Z', price: 2.00 }
  ];
  const remoteItems = [
    { id: 'item_1', name: 'Remote Newer Cake', updatedAt: '2026-11-02T10:00:00Z', price: 12.00 },
    { id: 'item_2', name: 'Remote Older Cookie', updatedAt: '2026-11-02T10:00:00Z', price: 1.50 },
    { id: 'item_3', name: 'Remote New Item', updatedAt: '2026-11-01T10:00:00Z', price: 5.00 }
  ];
  const resolved = syncMgr.resolveCollectionLWW(localItems, remoteItems);
  assert(resolved.length === 3, 'Merged collection contains all 3 items');
  const resItem1 = resolved.find(i => i.id === 'item_1');
  assert(resItem1.name === 'Remote Newer Cake', 'Newer remote item overwrites older local item');
  const resItem2 = resolved.find(i => i.id === 'item_2');
  assert(resItem2.name === 'Local Newer Cookie', 'Newer local item is preserved over older remote item');
  const resItem3 = resolved.find(i => i.id === 'item_3');
  assert(resItem3.name === 'Remote New Item', 'Missing remote item is cleanly merged into collection');

  // F2-08: Backup export and import
  const backupJson = syncMgr.exportBackup();
  assert(typeof backupJson === 'string', 'exportBackup returns serialized string');
  const parsedBackup = JSON.parse(backupJson);
  assert(parsedBackup.app === 'SweetSmilePastry', 'Backup payload includes app metadata');
  assert(Array.isArray(parsedBackup.products), 'Backup payload includes products');

  // Import valid backup
  const mockRestore = {
    app: 'SweetSmilePastry',
    products: [{ id: 'p_res_1', name: 'Restored Tart', price: 8.50, stock: 5 }],
    inventory: [{ id: 'i_res_1', name: 'Restored Flour', stock: 100, unit: 'kg' }],
    recipes: [{ id: 'r_res_1', name: 'Restored Tart Recipe', portions: 8 }],
    invoices: [],
    settings: { storeName: 'Restored Sweet Smile' }
  };
  const importResult = await syncMgr.importBackup(JSON.stringify(mockRestore));
  assert(importResult === true, 'importBackup returns true for valid backup payload');

  // Import invalid JSON
  const invalidResult = await syncMgr.importBackup('CORRUPTED_JSON_NOT_VALID');
  assert(invalidResult === false, 'importBackup returns false on invalid JSON');

  // F2-09: Google credentials configuration
  syncMgr.connectGoogle({ accessToken: 'test_oauth_token_123', email: 'baker@sweetsmile.com' });
  const cfg = syncMgr.getGoogleConfig();
  assert(cfg.accessToken === 'test_oauth_token_123', 'connectGoogle records accessToken');
  assert(cfg.userEmail === 'baker@sweetsmile.com', 'connectGoogle records user email');
  assert(syncMgr.getStatus().hasGoogleConnection === true, 'hasGoogleConnection is true when credentials configured');

  syncMgr.disconnectGoogle();
  assert(syncMgr.getStatus().hasGoogleConnection === false, 'disconnectGoogle clears credentials');

  // -------------------------------------------------------------
  // TEST GROUP 3: UI & DOM CONTROLS WIRING
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: HTML Markup & UI Wiring ---');

  // Check index.html contains required elements
  const fs = await import('node:fs');
  const htmlContent = fs.readFileSync('index.html', 'utf-8');

  assert(htmlContent.includes('id="cloudSyncPill"'), 'index.html contains #cloudSyncPill');
  assert(htmlContent.includes('id="syncModal"'), 'index.html contains #syncModal');
  assert(htmlContent.includes('id="btnForceSync"'), 'index.html contains #btnForceSync');
  assert(htmlContent.includes('id="btnExportBackup"'), 'index.html contains #btnExportBackup');
  assert(htmlContent.includes('id="btnImportBackupTrigger"'), 'index.html contains #btnImportBackupTrigger');
  assert(htmlContent.includes('id="btnConnectGoogle"'), 'index.html contains #btnConnectGoogle');
  assert(htmlContent.includes('id="syncModalStatusText"'), 'index.html contains #syncModalStatusText');
  assert(htmlContent.includes('id="syncModalPendingBadge"'), 'index.html contains #syncModalPendingBadge');
  assert(htmlContent.includes('id="syncModalLastSync"'), 'index.html contains #syncModalLastSync');

  // Check app.js imports and wires googleSync and dbStorage
  const appContent = fs.readFileSync('js/app.js', 'utf-8');
  assert(appContent.includes("from './google-sync.js'"), 'app.js imports from google-sync.js');
  assert(appContent.includes("from './db.js'"), 'app.js imports from db.js');
  assert(appContent.includes('saveToIndexedDB("app_state"'), 'app.js persists state to IndexedDB');
  assert(appContent.includes('googleSync.queueMutation'), 'app.js queues mutations when offline');
  assert(appContent.includes('googleSync.getStatus()'), 'app.js queries live sync status');
  assert(appContent.includes('Sin Conexión'), 'app.js handles "Sin Conexión" state');
  assert(appContent.includes('Sincronizando...'), 'app.js handles "Sincronizando..." state');
  assert(appContent.includes('Pendiente'), 'app.js handles "Pendiente" state');
  assert(appContent.includes('Sincronizado'), 'app.js handles "Sincronizado" state');

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
