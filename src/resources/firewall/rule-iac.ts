/**
 * Firewall Rule IaC Resource
 * Declarative firewall rule management for Infrastructure as Code
 */

import { z } from 'zod';
import { IaCResource } from '../base.js';
import { resourceRegistry } from '../registry.js';

// Firewall rule properties schema
export const FirewallRulePropertiesSchema = z.object({
  enabled: z.boolean().default(true).describe('Enable/disable rule'),
  action: z.enum(['pass', 'block', 'reject']).describe('Rule action'),
  interface: z.string().describe('Interface name'),
  direction: z.enum(['in', 'out']).describe('Traffic direction'),
  ipprotocol: z.enum(['inet', 'inet6', 'inet46']).default('inet').describe('IP protocol version'),
  protocol: z.string().default('any').describe('Protocol (any, tcp, udp, icmp, etc.)'),
  source: z.string().default('any').describe('Source address/network or alias'),
  sourcePort: z.string().optional().describe('Source port or port range'),
  destination: z.string().default('any').describe('Destination address/network or alias'),
  destinationPort: z.string().optional().describe('Destination port or port range'),
  gateway: z.string().optional().describe('Optional gateway for policy routing'),
  log: z.boolean().default(false).describe('Log packets matching this rule'),
  description: z.string().optional().describe('Rule description'),
  category: z.string().optional().describe('Rule category for organization'),
  quick: z.boolean().default(true).describe('Stop processing after match'),
  sequence: z.number().optional().describe('Rule order/priority')
});

export type FirewallRuleProperties = z.infer<typeof FirewallRulePropertiesSchema>;

export class FirewallRuleResource extends IaCResource {
  readonly type = 'opnsense:firewall:rule';
  readonly schema = FirewallRulePropertiesSchema;

  constructor(id: string, name: string, properties: FirewallRuleProperties) {
    super(id, name, properties);
  }

  /**
   * Convert to OPNSense API payload
   */
  toAPIPayload(): any {
    const props = this._properties as FirewallRuleProperties;
    return {
      rule: {
        enabled: props.enabled ? '1' : '0',
        action: props.action,
        interface: props.interface,
        direction: props.direction,
        ipprotocol: props.ipprotocol,
        protocol: props.protocol,
        source_net: props.source,
        source_port: props.sourcePort || '',
        destination_net: props.destination,
        destination_port: props.destinationPort || '',
        gateway: props.gateway || '',
        log: props.log ? '1' : '0',
        description: props.description || '',
        category: props.category || '',
        quick: props.quick ? '1' : '0',
        sequence: props.sequence?.toString() || ''
      }
    };
  }

  /**
   * Update resource from API response
   */
  fromAPIResponse(response: any): void {
    if (response.rule || response) {
      const rule = response.rule || response;
      this._properties = {
        enabled: rule.enabled === '1',
        action: rule.action,
        interface: rule.interface,
        direction: rule.direction,
        ipprotocol: rule.ipprotocol || 'inet',
        protocol: rule.protocol || 'any',
        source: rule.source_net || 'any',
        sourcePort: rule.source_port || undefined,
        destination: rule.destination_net || 'any',
        destinationPort: rule.destination_port || undefined,
        gateway: rule.gateway || undefined,
        log: rule.log === '1',
        description: rule.description || undefined,
        category: rule.category || undefined,
        quick: rule.quick !== '0',
        sequence: rule.sequence ? parseInt(rule.sequence) : undefined
      };
      
      // Set outputs
      this._outputs = {
        uuid: rule.uuid,
        sequence: rule.sequence,
        enabled: rule.enabled === '1'
      };
    }
  }

  /**
   * Get required permissions for this resource
   */
  getRequiredPermissions(): string[] {
    return [
      'firewall:filter:rule:read',
      'firewall:filter:rule:write',
      'firewall:filter:apply'
    ];
  }

  /**
   * Validate firewall rule configuration
   */
  validateConfiguration(): { valid: boolean; errors?: string[] } {
    const props = this._properties as FirewallRuleProperties;
    const errors: string[] = [];

    // Validate protocol and port combinations
    const hasPort = props.sourcePort || props.destinationPort;
    const isPortProtocol = ['tcp', 'udp', 'tcp/udp'].includes(props.protocol.toLowerCase());
    
    if (hasPort && !isPortProtocol) {
      errors.push(`Ports can only be specified for TCP or UDP protocols, not ${props.protocol}`);
    }

    // Validate source and destination formats
    if (!this.isValidAddressFormat(props.source)) {
      errors.push(`Invalid source address format: ${props.source}`);
    }
    if (!this.isValidAddressFormat(props.destination)) {
      errors.push(`Invalid destination address format: ${props.destination}`);
    }

    // Validate port formats if specified
    if (props.sourcePort && !this.isValidPortFormat(props.sourcePort)) {
      errors.push(`Invalid source port format: ${props.sourcePort}`);
    }
    if (props.destinationPort && !this.isValidPortFormat(props.destinationPort)) {
      errors.push(`Invalid destination port format: ${props.destinationPort}`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  private isValidAddressFormat(address: string): boolean {
    if (address === 'any') return true;
    
    // Check for IP address (v4 or v6)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    const ipv6Regex = /^([0-9a-fA-F:]+)(\/\d{1,3})?$/;
    
    if (ipv4Regex.test(address) || ipv6Regex.test(address)) {
      return true;
    }
    
    // Could be an alias - allow alphanumeric with underscores
    const aliasRegex = /^[a-zA-Z0-9_]+$/;
    return aliasRegex.test(address);
  }

  private isValidPortFormat(port: string): boolean {
    // Single port
    if (/^\d{1,5}$/.test(port)) {
      const portNum = parseInt(port);
      return portNum >= 1 && portNum <= 65535;
    }
    
    // Port range
    if (/^\d{1,5}:\d{1,5}$/.test(port)) {
      const [start, end] = port.split(':').map(p => parseInt(p));
      return start >= 1 && start <= 65535 && end >= 1 && end <= 65535 && start < end;
    }
    
    // Port alias
    const aliasRegex = /^[a-zA-Z0-9_]+$/;
    return aliasRegex.test(port);
  }

  /**
   * Check if this rule conflicts with another
   */
  conflictsWith(other: FirewallRuleResource): boolean {
    const thisProps = this._properties as FirewallRuleProperties;
    const otherProps = other._properties as FirewallRuleProperties;
    
    // Check for duplicate rules (same interface, direction, source, dest, protocol)
    return (
      thisProps.interface === otherProps.interface &&
      thisProps.direction === otherProps.direction &&
      thisProps.source === otherProps.source &&
      thisProps.destination === otherProps.destination &&
      thisProps.protocol === otherProps.protocol &&
      thisProps.sourcePort === otherProps.sourcePort &&
      thisProps.destinationPort === otherProps.destinationPort
    );
  }
}

// Register the firewall rule resource type
resourceRegistry.register({
  type: 'opnsense:firewall:rule',
  category: 'firewall',
  description: 'Firewall filter rule configuration',
  schema: FirewallRulePropertiesSchema,
  factory: (id, name, properties) => new FirewallRuleResource(id, name, properties as FirewallRuleProperties),
  examples: [
    {
      name: 'Allow SSH',
      description: 'Allow SSH access to the firewall',
      properties: {
        enabled: true,
        action: 'pass',
        interface: 'wan',
        direction: 'in',
        protocol: 'tcp',
        source: 'any',
        destination: 'any',
        destinationPort: '22',
        description: 'Allow SSH access'
      }
    },
    {
      name: 'Block All',
      description: 'Block all incoming traffic on WAN',
      properties: {
        enabled: true,
        action: 'block',
        interface: 'wan',
        direction: 'in',
        protocol: 'any',
        source: 'any',
        destination: 'any',
        description: 'Block all incoming traffic'
      }
    }
  ]
});