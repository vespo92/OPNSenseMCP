/**
 * Live integration test for Monit management.
 * Runs against real OPNsense API. Restores original state on completion.
 */
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const AUTH = process.env.OPNSENSE_API_KEY + ':' + process.env.OPNSENSE_API_SECRET;
const BASE = process.env.OPNSENSE_HOST + '/api';
const TMP_JSON = join(tmpdir(), 'opnsense-monit-test-payload.json');

function api(path, body) {
  let cmd;
  if (body !== undefined) {
    writeFileSync(TMP_JSON, JSON.stringify(body));
    cmd = `curl -s -k -u "${AUTH}" -X POST -d @${TMP_JSON} -H "Content-Type: application/json" "${BASE}${path}"`;
  } else {
    cmd = `curl -s -k -u "${AUTH}" "${BASE}${path}"`;
  }
  const raw = execSync(cmd, { encoding: 'utf-8' });
  try { return JSON.parse(raw); } catch { return raw; }
}

function reconfigure() {
  writeFileSync(TMP_JSON, '{}');
  return JSON.parse(
    execSync(`curl -s -k -u "${AUTH}" -X POST -d @${TMP_JSON} "${BASE}/monit/service/reconfigure"`, { encoding: 'utf-8' })
  );
}

let pass = 0;
let fail = 0;
function assert(condition, label) {
  if (condition) { console.log(`  PASS: ${label}`); pass++; }
  else { console.log(`  FAIL: ${label}`); fail++; }
}

// Track created resources for cleanup
let createdTestUuid = null;
let createdServiceUuid = null;
let createdAlertUuid = null;

try {
  // ====== Test 1: Get Monit status ======
  console.log('=== Test 1: Monit service status ===');
  const serviceStatus = api('/monit/service/status');
  assert(serviceStatus.status === 'running', 'Monit is running');
  console.log('');

  // ====== Test 2: Get Monit settings ======
  console.log('=== Test 2: Get settings ===');
  const settings = api('/monit/settings/get');
  assert(settings.monit !== undefined, 'Settings have monit key');
  assert(settings.monit.general.enabled === '1', 'Monit is enabled');
  const serviceCount = Object.keys(settings.monit.service || {}).length;
  const testCount = Object.keys(settings.monit.test || {}).length;
  const alertCount = Object.keys(settings.monit.alert || {}).length;
  console.log(`  Services: ${serviceCount}, Tests: ${testCount}, Alerts: ${alertCount}`);
  assert(serviceCount > 0, 'Has at least one service');
  assert(testCount > 0, 'Has at least one test');
  console.log('');

  // ====== Test 3: Add a ProgramStatus test (needed for custom services) ======
  console.log('=== Test 3: Add a ProgramStatus test ===');
  const addTestResult = api('/monit/settings/addTest', {
    test: {
      name: 'LiveTestStatus',
      type: 'ProgramStatus',
      condition: 'status != 0',
      action: 'alert',
    }
  });
  assert(!!addTestResult.uuid, `Test created: ${addTestResult.uuid}`);
  createdTestUuid = addTestResult.uuid;

  // Don't reconfigure yet — orphan ProgramStatus tests are fine in config
  const verifyTest = api(`/monit/settings/getTest/${createdTestUuid}`);
  assert(verifyTest.test.name === 'LiveTestStatus', 'Test name matches');
  assert(verifyTest.test.condition === 'status != 0', 'Condition matches');
  console.log('');

  // ====== Test 4: Update the test ======
  console.log('=== Test 4: Update test condition ===');
  const updateTestResult = api(`/monit/settings/setTest/${createdTestUuid}`, {
    test: {
      name: 'LiveTestStatus',
      type: 'ProgramStatus',
      condition: 'changed status',
      action: 'alert',
    }
  });
  assert(updateTestResult.result === 'saved', 'Test updated');

  const verifyUpdatedTest = api(`/monit/settings/getTest/${createdTestUuid}`);
  assert(verifyUpdatedTest.test.condition === 'changed status', 'Updated condition matches');
  console.log('');

  // ====== Test 5: Add a custom service with the test attached ======
  console.log('=== Test 5: Add a custom service ===');
  const addSvcResult = api('/monit/settings/addService', {
    service: {
      enabled: '1',
      name: 'live_test_svc',
      type: 'custom',
      description: 'Live integration test service',
      path: '/usr/bin/true',
      timeout: '300',
      tests: createdTestUuid,
    }
  });
  assert(!!addSvcResult.uuid, `Service created: ${addSvcResult.uuid}`);
  createdServiceUuid = addSvcResult.uuid;
  const reconfAfterSvc = reconfigure();
  assert(reconfAfterSvc.result === 'Control file syntax OK', 'Config valid after adding service');

  const verifySvc = api(`/monit/settings/getService/${createdServiceUuid}`);
  assert(verifySvc.service.name === 'live_test_svc', 'Service name matches');
  console.log('');

  // ====== Test 6: Update the service ======
  console.log('=== Test 6: Update service - disable ===');
  const updateSvcResult = api(`/monit/settings/setService/${createdServiceUuid}`, {
    service: {
      enabled: '0',
      name: 'live_test_svc',
      type: 'custom',
      description: 'Updated live test',
      path: '/usr/bin/true',
      tests: createdTestUuid,
    }
  });
  assert(updateSvcResult.result === 'saved', 'Service updated');
  reconfigure();

  const verifyUpdatedSvc = api(`/monit/settings/getService/${createdServiceUuid}`);
  assert(verifyUpdatedSvc.service.enabled === '0', 'Service is now disabled');
  console.log('');

  // ====== Test 7: Add an alert ======
  console.log('=== Test 7: Add an alert recipient ===');
  const addAlertResult = api('/monit/settings/addAlert', {
    alert: {
      enabled: '1',
      recipient: 'livetest@example.com',
      noton: '0',
      events: 'connection,resource,status',
      format: 'Subject: TEST $SERVICE $EVENT',
      reminder: '5',
      description: 'Live test alert',
    }
  });
  assert(!!addAlertResult.uuid, `Alert created: ${addAlertResult.uuid}`);
  createdAlertUuid = addAlertResult.uuid;
  reconfigure();

  const verifyAlert = api(`/monit/settings/getAlert/${createdAlertUuid}`);
  assert(verifyAlert.alert.recipient === 'livetest@example.com', 'Alert recipient matches');

  // Check events are selected
  const selectedEvents = Object.entries(verifyAlert.alert.events)
    .filter(([, v]) => v.selected === 1)
    .map(([k]) => k);
  assert(selectedEvents.includes('connection'), 'Connection event selected');
  assert(selectedEvents.includes('resource'), 'Resource event selected');
  assert(selectedEvents.includes('status'), 'Status event selected');
  console.log('');

  // ====== Test 8: Update the alert ======
  console.log('=== Test 8: Update alert - change events ===');
  const updateAlertResult = api(`/monit/settings/setAlert/${createdAlertUuid}`, {
    alert: {
      enabled: '1',
      recipient: 'livetest@example.com',
      noton: '0',
      events: 'timeout,connection',
      format: 'Subject: UPDATED $SERVICE $EVENT',
      reminder: '10',
      description: 'Updated test alert',
    }
  });
  assert(updateAlertResult.result === 'saved', 'Alert updated');
  reconfigure();

  const verifyUpdatedAlert = api(`/monit/settings/getAlert/${createdAlertUuid}`);
  const updatedEvents = Object.entries(verifyUpdatedAlert.alert.events)
    .filter(([, v]) => v.selected === 1)
    .map(([k]) => k);
  assert(updatedEvents.includes('timeout'), 'Timeout event now selected');
  assert(updatedEvents.includes('connection'), 'Connection event still selected');
  assert(!updatedEvents.includes('status'), 'Status event no longer selected');
  console.log('');

  // ====== Cleanup ======
  console.log('=== Cleanup: Delete created resources ===');

  // Delete service first (may reference test)
  if (createdServiceUuid) {
    const delSvc = api(`/monit/settings/delService/${createdServiceUuid}`, {});
    assert(delSvc.result === 'deleted', `Service ${createdServiceUuid} deleted`);
    createdServiceUuid = null;
  }

  if (createdTestUuid) {
    const delTest = api(`/monit/settings/delTest/${createdTestUuid}`, {});
    assert(delTest.result === 'deleted', `Test ${createdTestUuid} deleted`);
    createdTestUuid = null;
  }

  if (createdAlertUuid) {
    const delAlert = api(`/monit/settings/delAlert/${createdAlertUuid}`, {});
    assert(delAlert.result === 'deleted', `Alert ${createdAlertUuid} deleted`);
    createdAlertUuid = null;
  }

  const reconfResult = reconfigure();
  assert(reconfResult.result === 'Control file syntax OK', 'Config valid after cleanup');

  // Verify cleanup
  const finalSettings = api('/monit/settings/get');
  const finalServiceCount = Object.keys(finalSettings.monit.service || {}).length;
  const finalTestCount = Object.keys(finalSettings.monit.test || {}).length;
  const finalAlertCount = Object.keys(finalSettings.monit.alert || {}).length;
  assert(finalServiceCount === serviceCount, `Service count restored (${finalServiceCount})`);
  assert(finalTestCount === testCount, `Test count restored (${finalTestCount})`);
  assert(finalAlertCount === alertCount, `Alert count restored (${finalAlertCount})`);

} catch (err) {
  console.error('\nERROR:', err.message);
  fail++;

  // Emergency cleanup
  console.log('\nAttempting emergency cleanup...');
  try {
    if (createdServiceUuid) api(`/monit/settings/delService/${createdServiceUuid}`, {});
    if (createdTestUuid) api(`/monit/settings/delTest/${createdTestUuid}`, {});
    if (createdAlertUuid) api(`/monit/settings/delAlert/${createdAlertUuid}`, {});
    reconfigure();
    console.log('Cleanup complete.');
  } catch (cleanupErr) {
    console.error('Cleanup failed:', cleanupErr.message);
  }
}

// Cleanup temp file
try { unlinkSync(TMP_JSON); } catch {}

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
