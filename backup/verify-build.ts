import { execSync } from 'child_process';
import { existsSync } from 'fs';

console.log('Building OPNsense MCP Server...\n');

try {
  // Run the build
  execSync('npm run build', { 
    stdio: 'inherit',
    cwd: 'C:\\Users\\VinSpo\\Desktop\\OPNSenseMCP'
  });
  
  console.log('\n✅ Build completed successfully!');
  
  // Check if output files exist
  const outputFiles = [
    'dist/index.js',
    'dist/api/client.js',
    'dist/resources/vlan.js',
    'dist/resources/firewall/rule.js'
  ];
  
  console.log('\nChecking output files:');
  outputFiles.forEach(file => {
    const fullPath = `C:\\Users\\VinSpo\\Desktop\\OPNSenseMCP\\${file}`;
    const exists = existsSync(fullPath);
    console.log(`  ${file}: ${exists ? '✅' : '❌'}`);
  });
  
} catch (error) {
  console.error('\n❌ Build failed!');
  console.error(error);
  process.exit(1);
}
