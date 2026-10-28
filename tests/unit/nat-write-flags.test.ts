/**
 * Unit tests for the boolean flags NAT writes put into config.xml.
 *
 * OPNsense evaluates disabled/nonat/log with PHP's `!empty()`, so an empty
 * element such as `<disabled/>` counts as unset. The create methods used to
 * write exactly that, which meant a rule requested as disabled went live,
 * a no-NAT exception became a NAT rule, and logging stayed off.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NATResource } from '../../src/resources/firewall/nat.js';

describe('NAT create methods write flags by value', () => {
  let nat: any;
  let saved: any;

  beforeEach(() => {
    saved = undefined;
    nat = new NATResource({} as any);
    nat.sshExecutor = {};
    nat.getNATConfigViaSSH = async () => ({ nat: { outbound: { mode: 'hybrid' } } });
    nat.saveNATConfigViaSSH = async (config: any) => { saved = config; };
    nat.applyNATChanges = async () => ({ success: true });
  });

  const lastPortForward = () => saved.nat.rule[saved.nat.rule.length - 1];
  const lastOutbound = () => saved.nat.outbound.rule[saved.nat.outbound.rule.length - 1];

  describe('createPortForward', () => {
    const RULE = { interface: 'wan', protocol: 'tcp', destination_port: '2222', target: '192.168.1.20' };

    it('writes disabled as "1" for a rule requested as disabled', async () => {
      await nat.createPortForward({ ...RULE, enabled: '0' });
      expect(lastPortForward().disabled).toBe('1');
      expect(nat.normalizePortForwardFromXML(lastPortForward(), 'pf-0').enabled).toBe('0');
    });

    it('writes disabled as "0" for an enabled rule', async () => {
      await nat.createPortForward({ ...RULE, enabled: '1' });
      expect(lastPortForward().disabled).toBe('0');
      expect(nat.normalizePortForwardFromXML(lastPortForward(), 'pf-0').enabled).toBe('1');
    });

    it('writes log by value', async () => {
      await nat.createPortForward({ ...RULE, log: '1' });
      expect(lastPortForward().log).toBe('1');
      await nat.createPortForward(RULE);
      expect(lastPortForward().log).toBe('0');
    });
  });

  describe('createOutboundRule', () => {
    const RULE = { interface: 'wan', source_net: '10.8.0.0/24', destination_net: '192.168.1.0/24' };

    it('writes nonat as "1" for a no-NAT exception and omits the target', async () => {
      await nat.createOutboundRule({ ...RULE, nonat: '1', target: '' });
      expect(lastOutbound().nonat).toBe('1');
      expect(lastOutbound().target).toBeUndefined();
      expect(nat.normalizeOutboundRuleFromXML(lastOutbound()).nonat).toBe('1');
    });

    it('does not treat an empty target as a no-NAT rule', async () => {
      // OPNsense translates to the interface address when no target is set.
      await nat.createOutboundRule({ ...RULE, target: '' });
      expect(lastOutbound().nonat).toBe('0');
    });

    it('writes the target of a NAT rule', async () => {
      await nat.createOutboundRule({ ...RULE, target: '203.0.113.5' });
      expect(lastOutbound()).toMatchObject({ nonat: '0', target: '203.0.113.5' });
    });

    it('writes disabled by value', async () => {
      await nat.createOutboundRule({ ...RULE, enabled: '0' });
      expect(lastOutbound().disabled).toBe('1');
      expect(nat.normalizeOutboundRuleFromXML(lastOutbound()).enabled).toBe('0');

      await nat.createOutboundRule({ ...RULE, enabled: '1' });
      expect(lastOutbound().disabled).toBe('0');
    });

    it('writes log by value', async () => {
      await nat.createOutboundRule({ ...RULE, log: '1' });
      expect(lastOutbound().log).toBe('1');
    });

    it('never writes an empty flag element', async () => {
      await nat.createOutboundRule({ ...RULE, nonat: '1', enabled: '0', log: '1' });
      for (const flag of ['disabled', 'nonat', 'log']) {
        expect(lastOutbound()[flag]).not.toBe('');
      }
    });
  });
});
