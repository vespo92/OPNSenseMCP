/**
 * Unit tests for FirewallRuleResource.flattenRule().
 *
 * update_firewall_rule and toggle_firewall_rule re-post the result of getRule
 * through setRule. getRule returns option objects ({key: {value, selected}})
 * and, for `categories`, a plain array — neither of which setRule's PHP
 * backend accepts. Anything that reaches setRule un-flattened comes back to
 * the caller as an opaque MCP -32600.
 */
import { describe, it, expect } from 'vitest';
import { FirewallRuleResource } from '../../src/resources/firewall/rule.js';

describe('flattenRule array handling (issue #97)', () => {
  it('flattens an empty categories array to an empty string, not "[]"', () => {
    const out = FirewallRuleResource.flattenRule({ categories: [] });

    // The reporter confirmed via curl that setRule accepts "" here.
    expect(out.categories).toBe('');
    expect(Array.isArray(out.categories)).toBe(false);
  });

  it('comma-joins a populated categories array', () => {
    const out = FirewallRuleResource.flattenRule({
      categories: ['4a1d-uuid', '9f2c-uuid'],
    });

    expect(out.categories).toBe('4a1d-uuid,9f2c-uuid');
  });

  it('never leaks an array into the setRule payload', () => {
    const out = FirewallRuleResource.flattenRule({
      categories: [],
      aliases: ['a', 'b'],
      description: 'test',
    });

    for (const [key, value] of Object.entries(out)) {
      expect(Array.isArray(value), `${key} must not stay an array`).toBe(false);
    }
  });
});

describe('flattenRule option-object handling (regression for #95)', () => {
  it('collapses an option object to its selected keys', () => {
    const out = FirewallRuleResource.flattenRule({
      protocol: {
        TCP: { value: 'TCP', selected: 1 },
        UDP: { value: 'UDP', selected: 0 },
      },
    });

    expect(out.protocol).toBe('TCP');
  });

  it('joins multiple selected keys with a comma', () => {
    const out = FirewallRuleResource.flattenRule({
      interface: {
        lan: { value: 'LAN', selected: 1 },
        wan: { value: 'WAN', selected: 1 },
        opt1: { value: 'OPT1', selected: 0 },
      },
    });

    expect(out.interface).toBe('lan,wan');
  });

  it('passes scalars through untouched, including "0"/"1" flags', () => {
    const out = FirewallRuleResource.flattenRule({
      description: 'web',
      log: '0',
      enabled: '1',
      sequence: 200,
    });

    expect(out).toMatchObject({
      description: 'web',
      log: '0',
      enabled: '1',
      sequence: 200,
    });
  });

  it('leaves null and undefined alone rather than stringifying them', () => {
    const out = FirewallRuleResource.flattenRule({ a: null, b: undefined });

    expect(out.a).toBeNull();
    expect(out.b).toBeUndefined();
  });
});
