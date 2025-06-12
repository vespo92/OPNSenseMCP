# Phase 2 Planning - OPNSense MCP Server

## Overview
With Phase 1 complete, we have a solid resource-based Infrastructure-as-Code foundation. Phase 2 will add network discovery, enhanced resource types, and prepare for multi-MCP integration.

## Phase 2 Goals

### 0. API Integration Fix (Priority 0 - CRITICAL)
Based on Phase 1 testing, we need to fix the API integration layer first:

#### Issues to Fix:
- All resource creation API calls return 400 errors
- Endpoint URLs may be outdated
- Payload formats need verification
- Authentication headers might need adjustment

#### Action Items:
1. **API Discovery Session**
   - Open OPNSense web UI with DevTools
   - Create a VLAN manually and capture the API call
   - Create a firewall alias and capture the API call
   - Document exact endpoints and payload formats

2. **Update Resource Implementations**
   - Fix endpoint mappings in `src/index.ts`
   - Update `toApiPayload()` methods in all resource classes
   - Add proper error handling with detailed messages

3. **Create API Test Suite**
   - Standalone test file for each resource type
   - Use actual OPNSense API to verify formats
   - Document working examples

#### Success Criteria:
- Can create a VLAN via MCP
- Can create firewall aliases via MCP
- Can create firewall rules via MCP
- All Phase 1 resource types working

### 1. Network Discovery Tools (Priority 1)
Add tools for network visibility and device discovery:

#### Tools to Add:
- `searchMacAddress` - Find devices by MAC address
- `getArpTable` - View ARP cache entries  
- `getNetworkTopology` - Map network structure
- `getDhcpLeases` - List active DHCP leases
- `getInterfaceStats` - Network interface statistics

#### Benefits:
- Find devices on the network (Aruba switches, MikroTik, etc.)
- Monitor network health
- Troubleshoot connectivity
- Inventory management

### 2. Enhanced HAProxy Management (Priority 2)
Complete HAProxy resource types for load balancing:

#### Resources to Add:
- `opnsense:services:haproxy:healthcheck` - Health check configs
- `opnsense:services:haproxy:acl` - Access control lists
- `opnsense:services:haproxy:action` - HAProxy actions
- `opnsense:services:haproxy:errorfile` - Custom error pages

#### Tools to Add:
- `getHaproxyStats` - Real-time load balancer statistics
- `drainBackendServer` - Gracefully remove server
- `enableMaintenanceMode` - Put backend in maintenance

### 3. DNS Zone Management (Priority 3)
Full DNS control through Unbound:

#### Resources to Add:
- `opnsense:services:dns:zone` - DNS zones
- `opnsense:services:dns:record` - A, AAAA, CNAME, etc.
- `opnsense:services:dns:forwarder` - Conditional forwarding

#### Tools to Add:
- `queryDns` - Test DNS resolution
- `flushDnsCache` - Clear DNS cache

### 4. Certificate Management (Priority 4)
HTTPS certificate automation:

#### Resources to Add:
- `opnsense:system:certificate` - Certificates
- `opnsense:system:ca` - Certificate authorities
- `opnsense:services:acme:account` - Let's Encrypt accounts
- `opnsense:services:acme:certificate` - ACME certificates

#### Tools to Add:
- `generateCertificate` - Create self-signed cert
- `requestAcmeCertificate` - Get Let's Encrypt cert
- `listExpiringCertificates` - Certificate monitoring

### 5. Multi-MCP Orchestration Prep (Priority 5)
Prepare for ecosystem integration:

#### Features to Add:
- Resource tagging for cross-MCP references
- Event emission for state changes
- Webhook support for external triggers
- Bulk import/export formats

#### Example Cross-MCP Flow:
```yaml
# Deploy web app across MCP servers
1. TrueNAS MCP: Create dataset for app data
2. OPNSense MCP: Create VLAN and firewall rules
3. Docker MCP: Deploy containers
4. OPNSense MCP: Configure HAProxy
5. Monitoring MCP: Set up alerts
```

## Implementation Timeline

### Week 1: Network Discovery
- [ ] Implement MAC search tool
- [ ] Add ARP table viewer
- [ ] Create network topology mapper
- [ ] Test with real devices

### Week 2: HAProxy Enhancement  
- [ ] Complete HAProxy resources
- [ ] Add statistics tools
- [ ] Implement maintenance mode
- [ ] Test load balancing scenarios

### Week 3: DNS & Certificates
- [ ] Add DNS zone management
- [ ] Implement certificate resources
- [ ] Create ACME integration
- [ ] Test SSL automation

### Week 4: Integration & Testing
- [ ] Add cross-MCP features
- [ ] Create orchestration examples
- [ ] Performance optimization
- [ ] Documentation update

## Technical Considerations

### API Discovery Needed
For each new feature, we need to:
1. Use browser DevTools on OPNSense UI
2. Capture API calls
3. Document request/response formats
4. Handle error cases

### Resource Validation
Each new resource type needs:
- Property validation rules
- Dependency requirements
- API payload mapping
- State transition logic

### Testing Strategy
- Unit tests for each resource type
- Integration tests with mock API
- End-to-end tests on test OPNSense
- Cross-MCP workflow tests

## Success Metrics

### Phase 2 Complete When:
- [ ] All network discovery tools working
- [ ] HAProxy fully manageable via MCP
- [ ] DNS automation functional
- [ ] Certificate lifecycle automated
- [ ] Ready for multi-MCP orchestration

### Performance Targets:
- Network discovery < 2 seconds
- Resource operations < 1 second
- Bulk operations < 10 seconds
- State sync < 500ms

## Risk Mitigation

### Potential Issues:
1. **API Changes** - OPNSense updates may break endpoints
   - Solution: Version detection and compatibility layer

2. **Performance** - Large networks may slow discovery
   - Solution: Pagination and caching

3. **Complexity** - Too many resource types
   - Solution: Modular architecture, lazy loading

4. **Integration** - Cross-MCP coordination
   - Solution: Event-driven architecture

## Resources Needed

### Documentation:
- OPNSense API docs
- HAProxy plugin API
- Unbound DNS API
- ACME plugin API

### Testing Infrastructure:
- Test OPNSense instance
- Network with multiple VLANs
- Various network devices
- SSL certificate testing

### Development Tools:
- API testing tools (Postman/Insomnia)
- Network packet capture
- Performance profiling
- TypeScript debugging

## Next Immediate Steps

1. **Fix API Integration** (Priority 0)
   - Use browser DevTools to capture working API calls
   - Update resource implementations
   - Verify all Phase 1 resources work

2. **Then proceed with original plan**:
   - Set up test environment with diverse network devices
   - Start API discovery for network tools
   - Create Phase 2 branch in version control
   - Begin with MAC search tool as proof of concept

## Lessons Learned from Phase 1

### What Worked Well
- TypeScript architecture is solid
- Resource abstraction model is flexible
- Dependency resolution is robust
- State management is reliable

### What Needs Improvement
- **API Documentation**: Need better documentation of actual API calls
- **Error Handling**: Add more descriptive error messages
- **Testing**: Need integration tests with real API
- **Debugging**: Add debug mode to log API requests/responses

### Best Practices for Phase 2
1. **API First**: Always verify API calls work before implementing
2. **Test Early**: Create simple test scripts for each endpoint
3. **Document Everything**: Keep examples of working API calls
4. **Incremental Development**: Test each feature as you build it

---

**Phase 2 Estimated Duration**: 4 weeks  
**Phase 2 Complexity**: High  
**Phase 2 Value**: Critical for full automation
