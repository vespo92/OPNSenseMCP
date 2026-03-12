/**
 * Live integration test for ACME Client management.
 * Runs against real OPNsense API. Restores original state on completion.
 *
 * NOTE: Does NOT trigger certificate renewal/signing/revocation to avoid
 * hitting Let's Encrypt rate limits. Those paths are unit-tested only.
 */
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const AUTH = process.env.OPNSENSE_API_KEY + ':' + process.env.OPNSENSE_API_SECRET;
const BASE = process.env.OPNSENSE_HOST + '/api';
const TMP_JSON = join(tmpdir(), 'opnsense-acme-test-payload.json');

function api(path, body) {
  let cmd;
  if (body !== undefined) {
    writeFileSync(TMP_JSON, JSON.stringify(body));
    cmd = `curl -s -k -u "${AUTH}" -X POST -d "@${TMP_JSON}" -H "Content-Type: application/json" "${BASE}${path}"`;
  } else {
    cmd = `curl -s -k -u "${AUTH}" "${BASE}${path}"`;
  }
  const raw = execSync(cmd, { encoding: 'utf-8' });
  try { return JSON.parse(raw); } catch { return raw; }
}

function reconfigure() {
  writeFileSync(TMP_JSON, '{}');
  return execSync(
    `curl -s -k -u "${AUTH}" -X POST -d "@${TMP_JSON}" -H "Content-Type: application/json" "${BASE}/acmeclient/service/reconfigure"`,
    { encoding: 'utf-8' }
  );
}

let pass = 0;
let fail = 0;
function assert(condition, label) {
  if (condition) { console.log(`  PASS: ${label}`); pass++; }
  else { console.log(`  FAIL: ${label}`); fail++; }
}

// Track created resources
let createdActionUuid = null;

// Capture original state for restore
const originalSettings = api('/acmeclient/settings/get');
const certUuids = Object.keys(originalSettings.acmeclient?.certificates?.certificate || {});
const origActionCount = Object.keys(originalSettings.acmeclient?.actions?.action || {}).length;

console.log(`Original state: ${certUuids.length} cert(s), ${origActionCount} action(s)\n`);

// Save original cert values for restore
let originalRenewInterval = null;
let originalDescription = null;
const testCertUuid = certUuids[0];

if (testCertUuid) {
  const cert = originalSettings.acmeclient.certificates.certificate[testCertUuid];
  originalRenewInterval = cert.renewInterval;
  originalDescription = cert.description;
}

try {
  // ====== Test 1: Get settings overview ======
  console.log('=== Test 1: Get ACME settings ===');
  assert(originalSettings.acmeclient !== undefined, 'Settings have acmeclient key');
  assert(originalSettings.acmeclient.settings.enabled === '1', 'ACME is enabled');
  assert(certUuids.length > 0, `Found ${certUuids.length} certificate(s)`);

  const acctCount = Object.keys(originalSettings.acmeclient?.accounts?.account || {}).length;
  const valCount = Object.keys(originalSettings.acmeclient?.validations?.validation || {}).length;
  console.log(`  Accounts: ${acctCount}, Validations: ${valCount}, Actions: ${origActionCount}`);
  console.log('');

  // ====== Test 2: Get service status ======
  console.log('=== Test 2: ACME service status ===');
  const status = api('/acmeclient/service/status');
  assert(status.status === 'running', 'ACME service is running');
  console.log('');

  // ====== Test 3: Add an automation action ======
  console.log('=== Test 3: Add automation action ===');
  const addActionResult = api('/acmeclient/actions/add', {
    action: {
      enabled: '1',
      name: 'Live Test Action',
      type: 'configd_restart_gui',
      description: 'Created by live test',
    },
  });
  assert(!!addActionResult.uuid, `Action created: ${addActionResult.uuid}`);
  createdActionUuid = addActionResult.uuid;
  reconfigure();

  // Verify action exists
  const afterAdd = api('/acmeclient/settings/get');
  const actionEntry = afterAdd.acmeclient?.actions?.action?.[createdActionUuid];
  assert(actionEntry !== undefined, 'Action found in settings');
  assert(actionEntry?.name === 'Live Test Action', 'Action name matches');
  console.log('');

  // ====== Test 4: Update certificate via settings/set ======
  if (testCertUuid) {
    console.log('=== Test 4: Update certificate renewInterval ===');
    const updateResult = api('/acmeclient/settings/set', {
      acmeclient: {
        certificates: {
          certificate: {
            [testCertUuid]: {
              renewInterval: '14',
              description: 'Live test update',
            },
          },
        },
      },
    });
    assert(updateResult.result === 'saved', 'Certificate update saved');
    reconfigure();

    // Verify
    const afterUpdate = api('/acmeclient/settings/get');
    const updatedCert = afterUpdate.acmeclient.certificates.certificate[testCertUuid];
    assert(updatedCert.renewInterval === '14', `Renewal interval is 14 (was ${originalRenewInterval})`);
    assert(updatedCert.description === 'Live test update', 'Description updated');
    console.log('');

    // ====== Test 5: Update certificate restartActions via settings/set ======
    console.log('=== Test 5: Link new action to certificate ===');
    // Get current restart actions
    const currentActions = Object.entries(updatedCert.restartActions || {})
      .filter(([, v]) => v.selected === 1)
      .map(([k]) => k);

    const allActions = [...currentActions, createdActionUuid];
    const linkResult = api('/acmeclient/settings/set', {
      acmeclient: {
        certificates: {
          certificate: {
            [testCertUuid]: {
              restartActions: allActions.join(','),
            },
          },
        },
      },
    });
    assert(linkResult.result === 'saved', 'Restart actions updated');
    reconfigure();

    // Verify
    const afterLink = api('/acmeclient/settings/get');
    const linkedCert = afterLink.acmeclient.certificates.certificate[testCertUuid];
    const linkedActions = Object.entries(linkedCert.restartActions || {})
      .filter(([, v]) => v.selected === 1)
      .map(([k]) => k);
    assert(linkedActions.includes(createdActionUuid), 'New action is linked to certificate');
    console.log('');
  } else {
    console.log('=== Test 4-5: SKIPPED (no certificates found) ===\n');
  }

  // ====== Cleanup ======
  console.log('=== Cleanup ===');

  // Restore original certificate values
  if (testCertUuid) {
    // First unlink the test action, then restore original values
    const origActions = Object.entries(originalSettings.acmeclient.certificates.certificate[testCertUuid].restartActions || {})
      .filter(([, v]) => v.selected === 1)
      .map(([k]) => k);

    const restoreResult = api('/acmeclient/settings/set', {
      acmeclient: {
        certificates: {
          certificate: {
            [testCertUuid]: {
              renewInterval: originalRenewInterval,
              description: originalDescription,
              restartActions: origActions.join(','),
            },
          },
        },
      },
    });
    assert(restoreResult.result === 'saved', 'Certificate restored to original');
    reconfigure();
  }

  // Delete test action
  if (createdActionUuid) {
    const delResult = api(`/acmeclient/actions/del/${createdActionUuid}`, {});
    assert(delResult.result === 'deleted', `Action ${createdActionUuid} deleted`);
    createdActionUuid = null;
    reconfigure();
  }

  // Verify cleanup
  const finalSettings = api('/acmeclient/settings/get');
  const finalActionCount = Object.keys(finalSettings.acmeclient?.actions?.action || {}).length;
  assert(finalActionCount === origActionCount, `Action count restored (${finalActionCount})`);

  if (testCertUuid) {
    const finalCert = finalSettings.acmeclient.certificates.certificate[testCertUuid];
    assert(finalCert.renewInterval === originalRenewInterval, `Renewal interval restored to ${originalRenewInterval}`);
    assert(finalCert.description === originalDescription, 'Description restored');
  }

} catch (err) {
  console.error('\nERROR:', err.message);
  fail++;

  // Emergency cleanup
  console.log('\nAttempting emergency cleanup...');
  try {
    if (testCertUuid) {
      const origActions = Object.entries(originalSettings.acmeclient.certificates.certificate[testCertUuid].restartActions || {})
        .filter(([, v]) => v.selected === 1)
        .map(([k]) => k);
      api('/acmeclient/settings/set', {
        acmeclient: {
          certificates: {
            certificate: {
              [testCertUuid]: {
                renewInterval: originalRenewInterval,
                description: originalDescription,
                restartActions: origActions.join(','),
              },
            },
          },
        },
      });
    }
    if (createdActionUuid) api(`/acmeclient/actions/del/${createdActionUuid}`, {});
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
