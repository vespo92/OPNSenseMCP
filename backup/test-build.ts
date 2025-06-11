#!/usr/bin/env node

console.log('Testing TypeScript compilation...\n');

import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

const projectDir = 'C:\\Users\\VinSpo\\Desktop\\OPNSenseMCP';
const distDir = join(projectDir, 'dist');

// Clean dist directory
console.log('1. Cleaning dist directory...');
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
  console.log('   ✅ Dist directory cleaned');
} else {
  console.log('   ✅ Dist directory already clean');
}

// Run TypeScript compiler
console.log('\n2. Running TypeScript compiler...');
try {
  execSync('npx tsc', { 
    cwd: projectDir,
    stdio: 'inherit'
  });
  console.log('\n   ✅ TypeScript compilation successful!');
} catch (error) {
  console.error('\n   ❌ TypeScript compilation failed!');
  process.exit(1);
}

// Verify output files
console.log('\n3. Verifying output files...');
const expectedFiles = [
  'dist/index.js',
  'dist/api/client.js',
  'dist/resources/vlan.js',
  'dist/resources/firewall/rule.js'
];

let allFilesExist = true;
expectedFiles.forEach(file => {
  const fullPath = join(projectDir, file);
  const exists = existsSync(fullPath);
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

if (allFilesExist) {
  console.log('\n✅ Build verification complete - all files generated successfully!');
  console.log('\nNext steps:');
  console.log('1. Restart Claude Desktop');
  console.log('2. Test the new firewall rule tools!');
} else {
  console.log('\n❌ Some files are missing!');
  process.exit(1);
}
