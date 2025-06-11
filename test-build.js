const { execSync } = require('child_process');
const { existsSync, rmSync } = require('fs');
const { join } = require('path');

console.log('Testing OPNsense MCP Server Build...\n');

const projectDir = process.cwd();
const distDir = join(projectDir, 'dist');

// Clean dist directory
console.log('1. Cleaning dist directory...');
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
  console.log('   ✅ Dist directory cleaned');
}

// Run TypeScript compiler
console.log('\n2. Running TypeScript compiler...');
try {
  execSync('npx tsc', { stdio: 'inherit' });
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
  const exists = existsSync(file);
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

if (allFilesExist) {
  console.log('\n✅ Build verification complete!');
  console.log('\nThe OPNsense MCP server has been built successfully.');
  console.log('\nNext steps:');
  console.log('1. Restart Claude Desktop');
  console.log('2. Test the new firewall rule tools!');
  console.log('\nExample commands to try in Claude:');
  console.log('- "List all firewall rules"');
  console.log('- "Create a firewall rule to allow Minecraft on LAN"');
  console.log('- "Find all rules that block traffic"');
} else {
  console.log('\n❌ Some expected files are missing!');
}
