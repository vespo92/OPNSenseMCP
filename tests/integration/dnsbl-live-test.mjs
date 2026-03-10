/**
 * Live integration test for DNSBL subscription management.
 * Runs against real OPNsense API. Restores original state on completion.
 */
import { execSync, spawnSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const AUTH = process.env.OPNSENSE_API_KEY + ':' + process.env.OPNSENSE_API_SECRET;
const BASE = process.env.OPNSENSE_HOST + '/api';
const TMP_JSON = join(tmpdir(), 'opnsense-test-payload.json');

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
  // POST with empty body
  writeFileSync(TMP_JSON, '{}');
  execSync(`curl -s -k -u "${AUTH}" -X POST -d @${TMP_JSON} "${BASE}/unbound/service/reconfigure"`, { encoding: 'utf-8' });
}

function getSelectedTypes(uuid) {
  const data = api(`/unbound/settings/getDnsbl/${uuid}`);
  const types = [];
  if (data?.blocklist?.type) {
    for (const [key, info] of Object.entries(data.blocklist.type)) {
      if (info.selected === 1) types.push(key);
    }
  }
  return types;
}

let pass = 0;
let fail = 0;
function assert(condition, label) {
  if (condition) { console.log(`  PASS: ${label}`); pass++; }
  else { console.log(`  FAIL: ${label}`); fail++; }
}

// Capture original state
const originalSettings = api('/unbound/settings/get');
const originalEntries = Object.keys(originalSettings.unbound.dnsbl.blocklist);
const originalUuid = originalEntries[0];
const originalTypes = getSelectedTypes(originalUuid);
console.log(`Original state: UUID=${originalUuid}, types=[${originalTypes}]\n`);

try {
  // Test 1: Add a subscription to existing entry
  console.log('=== Test 1: Add Abuse.ch to existing entry ===');
  const setResult = api(`/unbound/settings/setDnsbl/${originalUuid}`, {
    blocklist: { enabled: '1', type: [...originalTypes, 'atf'].join(',') }
  });
  assert(setResult.result === 'saved', 'setDnsbl returned saved');
  reconfigure();

  const afterAdd = getSelectedTypes(originalUuid);
  assert(afterAdd.includes('atf'), 'atf is now selected');
  assert(afterAdd.includes(originalTypes[0]), 'original list still selected');
  console.log(`  Selected: [${afterAdd}]\n`);

  // Test 2: Create a new DNSBL entry
  console.log('=== Test 2: Create new DNSBL entry with EasyList ===');
  const addResult = api('/unbound/settings/addDnsbl', {
    blocklist: { enabled: '1', type: 'el', description: 'live test entry' }
  });
  assert(!!addResult.uuid, `New entry created: ${addResult.uuid}`);
  reconfigure();

  const newTypes = getSelectedTypes(addResult.uuid);
  assert(newTypes.includes('el'), 'EasyList is selected on new entry');
  console.log(`  New entry selected: [${newTypes}]\n`);

  // Test 3: Update the new entry - change list and disable
  console.log('=== Test 3: Update new entry - switch to EasyPrivacy, disable ===');
  const updateResult = api(`/unbound/settings/setDnsbl/${addResult.uuid}`, {
    blocklist: { enabled: '0', type: 'ep', description: 'updated test' }
  });
  assert(updateResult.result === 'saved', 'Update saved');
  reconfigure();

  const updatedData = api(`/unbound/settings/getDnsbl/${addResult.uuid}`);
  const updatedTypes = getSelectedTypes(addResult.uuid);
  assert(updatedTypes.includes('ep'), 'EasyPrivacy is selected');
  assert(!updatedTypes.includes('el'), 'EasyList is no longer selected');
  assert(updatedData.blocklist.enabled === '0', 'Entry is disabled');
  console.log(`  Updated: enabled=${updatedData.blocklist.enabled}, types=[${updatedTypes}]\n`);

  // Test 4: Delete the new entry
  console.log('=== Test 4: Delete new entry ===');
  const delResult = api(`/unbound/settings/delDnsbl/${addResult.uuid}`, {});
  assert(delResult.result === 'deleted', 'Entry deleted');
  reconfigure();

  const afterDel = api('/unbound/settings/get');
  const remainingUuids = Object.keys(afterDel.unbound.dnsbl.blocklist);
  assert(!remainingUuids.includes(addResult.uuid), 'New entry no longer exists');
  console.log('');

  // Test 5: Restore original entry
  console.log('=== Test 5: Restore original state ===');
  const restoreResult = api(`/unbound/settings/setDnsbl/${originalUuid}`, {
    blocklist: { enabled: '1', type: originalTypes.join(',') }
  });
  assert(restoreResult.result === 'saved', 'Restored original lists');
  reconfigure();

  const finalTypes = getSelectedTypes(originalUuid);
  assert(JSON.stringify(finalTypes.sort()) === JSON.stringify(originalTypes.sort()), 'Types match original');

  const finalSettings = api('/unbound/settings/get');
  const finalUuids = Object.keys(finalSettings.unbound.dnsbl.blocklist);
  assert(finalUuids.length === originalEntries.length, `Entry count matches (${finalUuids.length})`);

} catch (err) {
  console.error('\nERROR:', err.message);
  console.log('\nAttempting to restore original state...');
  api(`/unbound/settings/setDnsbl/${originalUuid}`, {
    blocklist: { enabled: '1', type: originalTypes.join(',') }
  });
  reconfigure();
  fail++;
}

// Cleanup temp file
try { unlinkSync(TMP_JSON); } catch {}

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
