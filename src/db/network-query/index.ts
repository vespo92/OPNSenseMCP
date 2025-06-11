// Network Query Engine - Main Export
export * from './schema';
export * from './fingerprints';
// Export specific items from query-engine to avoid conflicts
export { queryIntents as queryIntentDefinitions } from './query-engine';
export * from './processor';
export * from './fingerprinting';
export * from './mcp-integration';

// Quick start function for easy integration
import { NetworkQueryMCP } from './mcp-integration';
import { DeviceFingerprintingService } from './fingerprinting';
import { NaturalLanguageQueryProcessor } from './processor';

export async function createNetworkQueryEngine(config?: {
  postgresHost?: string;
  postgresPort?: string;
  postgresUser?: string;
  postgresPassword?: string;
  postgresDb?: string;
}) {
  const connectionString = `postgresql://${config?.postgresUser || process.env.POSTGRES_USER}:${config?.postgresPassword || process.env.POSTGRES_PASSWORD}@${config?.postgresHost || process.env.POSTGRES_HOST || '10.0.0.2'}:${config?.postgresPort || process.env.POSTGRES_PORT || '5432'}/${config?.postgresDb || process.env.POSTGRES_DB || 'opnsense_mcp'}`;
  
  const queryProcessor = new NaturalLanguageQueryProcessor(connectionString);
  const fingerprinting = new DeviceFingerprintingService(connectionString);
  
  // Initialize fingerprint database
  await fingerprinting.initializeFingerprints();
  
  return {
    queryProcessor,
    fingerprinting,
    processQuery: (query: string) => queryProcessor.processQuery(query),
    identifyDevice: (mac: string, hostname?: string) => fingerprinting.identifyDevice(mac, hostname),
    updateDeviceSummary: () => queryProcessor.updateDeviceSummaryView()
  };
}