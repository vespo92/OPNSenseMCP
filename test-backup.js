// Test script for backup functionality
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import after build
const { OPNSenseAPIClient } = require('./dist/api/client.js');
const { BackupManager } = require('./dist/resources/backup/manager.js');

async function testBackupSystem() {
  console.log('Testing OPNsense Backup Management...\n');

  try {
    // Create API client
    const client = new OPNSenseAPIClient({
      host: process.env.OPNSENSE_HOST,
      apiKey: process.env.OPNSENSE_API_KEY,
      apiSecret: process.env.OPNSENSE_API_SECRET,
      verifySsl: false
    });

    // Test connection
    console.log('Testing connection...');
    const connTest = await client.testConnection();
    console.log('Connection:', connTest);

    // Create backup manager
    const backupManager = new BackupManager(client, process.env.BACKUP_PATH);

    // Create a backup
    console.log('\n\nCreating backup...');
    try {
      const backup = await backupManager.createBackup({
        description: 'Test backup from MCP'
      });
      console.log('Backup created:', backup);
    } catch (error) {
      console.error('Failed to create backup:', error.message);
    }

    // List backups
    console.log('\n\nListing backups...');
    const backups = await backupManager.listBackups();
    console.log(`Found ${backups.length} backups:`);
    backups.forEach(b => {
      console.log(`  - ${b.id}: ${b.description} (${b.timestamp})`);
    });

    // Test withBackup decorator
    console.log('\n\nTesting safe operation with backup...');
    try {
      const result = await backupManager.withBackup(
        async () => {
          // Simulate an operation
          console.log('  Executing operation...');
          return { success: true, data: 'Operation completed' };
        },
        'Test operation with automatic backup'
      );
      console.log('Operation result:', result);
    } catch (error) {
      console.error('Operation failed:', error.message);
    }

  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testBackupSystem().catch(console.error);
