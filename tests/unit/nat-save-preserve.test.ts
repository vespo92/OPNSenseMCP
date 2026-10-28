/**
 * Unit tests for NAT writes to /conf/config.xml.
 *
 * NAT changes used to parse the whole document with xml2js (ignoreAttrs: true)
 * and serialize it back, which stripped every attribute from config.xml — all
 * uuid="..." on MVC firewall rules, aliases and source NAT rules — on a single
 * NAT write. Only the <nat> section may change now.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NATResource, spliceNATSection } from '../../src/resources/firewall/nat.js';

const CONFIG_XML = `<?xml version="1.0"?>
<opnsense>
  <!-- keep this comment -->
  <system>
    <hostname>fw</hostname>
  </system>
  <nat>
    <outbound>
      <mode>hybrid</mode>
    </outbound>
    <rule uuid="11111111-1111-4111-8111-111111111111">
      <disabled>0</disabled>
      <interface>wan</interface>
      <protocol>tcp</protocol>
      <destination>
        <network>wanip</network>
        <port>8443</port>
      </destination>
      <target>192.168.1.10</target>
      <local-port>443</local-port>
      <descr>web</descr>
    </rule>
  </nat>
  <OPNsense>
    <Firewall>
      <Filter version="1.0.6">
        <rules>
          <rule uuid="22222222-2222-4222-8222-222222222222">
            <enabled>1</enabled>
          </rule>
        </rules>
        <snatrules>
          <rule uuid="33333333-3333-4333-8333-333333333333">
            <enabled>1</enabled>
          </rule>
        </snatrules>
      </Filter>
    </Firewall>
  </OPNsense>
</opnsense>
`;

/** Everything outside the <nat> element, which must survive a write untouched. */
function outsideNAT(xml: string): string {
  return xml.replace(/<nat>[\s\S]*?<\/nat>/, '<nat/>');
}

describe('spliceNATSection', () => {
  it('replaces only the <nat> element', () => {
    const out = spliceNATSection(CONFIG_XML, '<nat><outbound><mode>manual</mode></outbound></nat>');
    expect(out).toContain('<mode>manual</mode>');
    expect(out).not.toContain('<descr>web</descr>');
    expect(outsideNAT(out)).toBe(outsideNAT(CONFIG_XML));
  });

  it('replaces a self-closing <nat/>', () => {
    const out = spliceNATSection('<opnsense><nat/><system/></opnsense>', '<nat><rule/></nat>');
    expect(out).toBe('<opnsense><nat><rule/></nat><system/></opnsense>');
  });

  it('does not mistake elements that merely start with "nat"', () => {
    const xml = '<opnsense><natreflection>purenat</natreflection><nat></nat></opnsense>';
    expect(spliceNATSection(xml, '<nat>x</nat>'))
      .toBe('<opnsense><natreflection>purenat</natreflection><nat>x</nat></opnsense>');
  });

  it('keeps "$" sequences in the replacement literal', () => {
    const out = spliceNATSection('<a><nat/></a>', "<nat><descr>$& $1 $'</descr></nat>");
    expect(out).toBe("<a><nat><descr>$& $1 $'</descr></nat></a>");
  });

  it('refuses to write when there is no <nat> element', () => {
    expect(() => spliceNATSection('<opnsense/>', '<nat/>')).toThrow(/exactly one <nat>/);
  });

  it('refuses to write when there are several <nat> elements', () => {
    expect(() => spliceNATSection('<a><nat/><b><nat/></b></a>', '<nat/>'))
      .toThrow(/exactly one <nat>/);
  });
});

describe('NAT writes preserve the rest of config.xml', () => {
  let nat: any;
  let written: string | undefined;

  beforeEach(() => {
    written = undefined;
    nat = new NATResource({} as any);
    nat.sshExecutor = {
      execute: async (cmd: string) => cmd === 'cat /conf/config.xml'
        ? { success: true, stdout: CONFIG_XML, stderr: '' }
        : { success: true, stdout: '', stderr: '' },
      executeBatch: async (commands: string[]) => {
        const heredoc = commands.find(c => c.includes("<< 'EOF'"))!;
        written = heredoc.slice(heredoc.indexOf('\n') + 1, heredoc.lastIndexOf('\nEOF'));
        return { success: true, results: [] };
      },
    };
  });

  it('keeps every uuid attribute when the outbound mode changes', async () => {
    expect(await nat.setOutboundMode('manual')).toBe(true);

    expect(written).toBeDefined();
    expect(written).toContain('<mode>manual</mode>');
    expect(written).toContain('uuid="11111111-1111-4111-8111-111111111111"');
    expect(written).toContain('uuid="22222222-2222-4222-8222-222222222222"');
    expect(written).toContain('uuid="33333333-3333-4333-8333-333333333333"');
    expect(written).toContain('<Filter version="1.0.6">');
    expect(outsideNAT(written!)).toBe(outsideNAT(CONFIG_XML));
  });

  it('writes a new port forward with its uuid and keeps the existing one', async () => {
    const { uuid } = await nat.createPortForward({
      interface: 'wan', protocol: 'tcp', destination_port: '2222',
      target: '192.168.1.20', local_port: '22', description: 'ssh',
    });

    expect(written).toContain(`<rule uuid="${uuid}">`);
    expect(written).toContain('<rule uuid="11111111-1111-4111-8111-111111111111">');
    expect(outsideNAT(written!)).toBe(outsideNAT(CONFIG_XML));
  });

  it('still reads rules once attributes are kept', async () => {
    const rules = await nat.listPortForwards();
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      enabled: '1', destination_port: '8443', target: '192.168.1.10',
      local_port: '443', description: 'web',
    });
  });
});
