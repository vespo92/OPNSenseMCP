/**
 * Unit tests for the NAT XML normalizers.
 *
 * These read `/conf/config.xml` through xml2js (explicitArray: false,
 * ignoreAttrs: true), so every element value arrives as a string. OPNsense
 * writes the boolean flags with "0"/"1" text content, which is why testing
 * element *presence* — or plain truthiness, since "0" is a truthy string —
 * reported these fields as constants regardless of the real configuration.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NATResource } from '../../src/resources/firewall/nat.js';

// The normalizers are pure and private; go through the instance rather than
// re-implementing them, so the test pins real behavior.
function makeResource(): any {
  return new NATResource({} as any);
}

// The rule from the issue report: enabled, logging off, sync on.
const ENABLED_RULE = {
  sequence: '200',
  disabled: '0',
  nordr: '0',
  interface: 'wan',
  protocol: 'tcp',
  destination: { network: 'wanip', port: '32400' },
  target: '10.0.0.50',
  'local-port': '32400',
  log: '0',
  descr: 'Plex Server Remote Access Redirect NAT',
  nosync: '0',
  pass: 'pass',
};

describe('normalizePortForwardFromXML flags (issue #98)', () => {
  let nat: any;
  beforeEach(() => { nat = makeResource(); });

  it('reports an enabled rule as enabled', () => {
    const out = nat.normalizePortForwardFromXML(ENABLED_RULE, 'pf-0');
    expect(out.enabled).toBe('1');
  });

  it('reports a disabled rule as disabled', () => {
    const out = nat.normalizePortForwardFromXML({ ...ENABLED_RULE, disabled: '1' }, 'pf-0');
    expect(out.enabled).toBe('0');
  });

  it('treats an absent disabled element as enabled', () => {
    const { disabled, ...noDisabled } = ENABLED_RULE;
    const out = nat.normalizePortForwardFromXML(noDisabled, 'pf-0');
    expect(out.enabled).toBe('1');
  });

  it('reads log and nosync by value, not by presence', () => {
    const off = nat.normalizePortForwardFromXML(ENABLED_RULE, 'pf-0');
    expect(off.log).toBe('0');
    expect(off.nosync).toBe('0');

    const on = nat.normalizePortForwardFromXML(
      { ...ENABLED_RULE, log: '1', nosync: '1' }, 'pf-0');
    expect(on.log).toBe('1');
    expect(on.nosync).toBe('1');
  });

  it('reproduces the exact payload from the issue report', () => {
    const out = nat.normalizePortForwardFromXML(ENABLED_RULE, 'pf-0');
    // Previously reported as enabled "0", nosync "1", log "1" — all three wrong.
    expect(out).toMatchObject({ enabled: '1', nosync: '0', log: '0' });
  });
});

describe('normalizeOutboundRuleFromXML flags (issue #98)', () => {
  let nat: any;
  beforeEach(() => { nat = makeResource(); });

  const OUTBOUND = {
    sequence: '100', interface: 'wan', disabled: '0',
    source: { network: 'lan' }, target: '', nonat: '0', log: '0', descr: 'out',
  };

  it('reports an enabled outbound rule as enabled', () => {
    // The old check was `rule.disabled ? '0' : '1'` — "0" is truthy in JS, so
    // this reported every rule as disabled.
    expect(nat.normalizeOutboundRuleFromXML(OUTBOUND).enabled).toBe('1');
  });

  it('reports a disabled outbound rule as disabled', () => {
    expect(nat.normalizeOutboundRuleFromXML({ ...OUTBOUND, disabled: '1' }).enabled).toBe('0');
  });

  it('reads nonat and log by value', () => {
    const off = nat.normalizeOutboundRuleFromXML(OUTBOUND);
    expect(off.nonat).toBe('0');
    expect(off.log).toBe('0');

    const on = nat.normalizeOutboundRuleFromXML({ ...OUTBOUND, nonat: '1', log: '1' });
    expect(on.nonat).toBe('1');
    expect(on.log).toBe('1');
  });
});

describe('NAT list methods without SSH (issue #98, secondary)', () => {
  let nat: any;
  beforeEach(() => {
    delete process.env.OPNSENSE_SSH_HOST;
    delete process.env.OPNSENSE_SSH_USERNAME;
    nat = makeResource();
  });

  it('fails loudly rather than reporting an empty port-forward list', async () => {
    await expect(nat.listPortForwards()).rejects.toThrow(/SSH not configured/i);
  });

  it('fails loudly rather than reporting an empty outbound list', async () => {
    await expect(nat.listOutboundRules()).rejects.toThrow(/SSH not configured/i);
  });
});
