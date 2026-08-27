import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('📦 Building Chrome Extension...');
execSync('npm run build --workspace=@prosperity/extension', { stdio: 'inherit' });

const distDir = path.resolve('apps/extension/dist');
const zipPath = path.resolve('prosperity-crm-extension.zip');

if (!fs.existsSync(distDir)) {
  console.error('❌ Error: apps/extension/dist directory not found.');
  process.exit(1);
}

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

console.log('🤐 Packaging dist into prosperity-crm-extension.zip...');
try {
  execSync(`cd apps/extension/dist && zip -r -q "${zipPath}" .`, { stdio: 'inherit' });
  console.log(`✅ Extension packaged successfully: ${zipPath}`);
} catch (e) {
  console.error('Failed to create zip:', e);
  process.exit(1);
}
