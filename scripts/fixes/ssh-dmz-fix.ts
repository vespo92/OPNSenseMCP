#!/usr/bin/env tsx
import { SSHExecutor } from '../../src/resources/ssh/executor.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function fixDMZNow() {
  console.log('🚀 SSH-Based DMZ Routing Fix');
  console.log('=============================\n');
  
  // Check for SSH credentials
  if (!process.env.OPNSENSE_SSH_HOST || !process.env.OPNSENSE_SSH_USERNAME) {
    console.log('❌ SSH credentials not configured!');
    console.log('\nPlease add to your .env file:');
    console.log('OPNSENSE_SSH_HOST=your-opnsense-host');
    console.log('OPNSENSE_SSH_USERNAME=root');
    console.log('OPNSENSE_SSH_PASSWORD=your-password');
    console.log('Or use SSH key:');
    console.log('OPNSENSE_SSH_KEY_PATH=~/.ssh/id_rsa');
    return;
  }

  const ssh = new SSHExecutor({
    host: process.env.OPNSENSE_SSH_HOST,
    port: parseInt(process.env.OPNSENSE_SSH_PORT || '22'),
    username: process.env.OPNSENSE_SSH_USERNAME,
    password: process.env.OPNSENSE_SSH_PASSWORD,
    privateKeyPath: process.env.OPNSENSE_SSH_KEY_PATH,
    passphrase: process.env.OPNSENSE_SSH_PASSPHRASE
  });

  try {
    console.log('📡 Connecting to OPNsense via SSH...');
    await ssh.connect();
    console.log('✅ Connected!\n');

    console.log('🔧 Applying comprehensive DMZ fix...');
    console.log('This will:');
    console.log('  1. Disable "Block private networks" on DMZ interface');
    console.log('  2. Reconfigure interfaces');
    console.log('  3. Reload firewall rules');
    console.log('  4. Apply all changes\n');

    const result = await ssh.quickDMZFix();
    
    if (result.success) {
      console.log('\n✅ DMZ Fix Applied Successfully!');
      console.log('\nActions completed:');
      result.actions.forEach(action => {
        console.log(`  ✓ ${action}`);
      });
      
      console.log('\n🧪 Test from DMZ node (10.0.6.2):');
      console.log('  ping 10.0.0.14         # Should work now!');
      console.log('  nc -zv 10.0.0.14 2049  # Test NFS port');
      console.log('  mount -t nfs 10.0.0.14:/mnt/SSDRAID/Kubes /mnt/test');
    } else {
      console.log('\n⚠️  Some issues occurred:');
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach(error => {
          console.log(`  ❌ ${error}`);
        });
      }
    }

    await ssh.disconnect();
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('ENOTFOUND')) {
      console.log('\n📝 Check your SSH settings in .env:');
      console.log(`  OPNSENSE_SSH_HOST=${process.env.OPNSENSE_SSH_HOST}`);
      console.log(`  OPNSENSE_SSH_USERNAME=${process.env.OPNSENSE_SSH_USERNAME}`);
    } else if (error.message.includes('Authentication')) {
      console.log('\n📝 SSH authentication failed. Check:');
      console.log('  - Username and password are correct');
      console.log('  - SSH is enabled on OPNsense');
      console.log('  - User has shell access');
    }
  }
}

// Run immediately
fixDMZNow().catch(console.error);