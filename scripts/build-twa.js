#!/usr/bin/env node

/**
 * Non-interactive TWA project generator for CI/CD.
 *
 * Uses @bubblewrap/core directly to generate the Android project
 * from twa-manifest.json — completely bypasses the interactive CLI.
 *
 * Usage: node scripts/build-twa.js [output-dir]
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

async function main() {
  const outputDir = process.argv[2] || 'android-project';
  const rootDir = process.cwd();
  const manifestPath = path.join(rootDir, 'twa-manifest.json');
  const absOutputDir = path.resolve(rootDir, outputDir);

  console.log('=== ResIQ TWA Project Generator ===\n');

  // Dynamically import @bubblewrap/core (ESM module)
  let core;
  try {
    core = await import('@bubblewrap/core');
  } catch (err) {
    console.error('Failed to import @bubblewrap/core:', err.message);
    console.error('Install it first: npm install @bubblewrap/core');
    process.exit(1);
  }

  // 1. Load twa-manifest.json
  console.log('1. Loading twa-manifest.json...');
  if (!fs.existsSync(manifestPath)) {
    console.error(`   ERROR: ${manifestPath} not found`);
    process.exit(1);
  }
  const twaManifest = await core.TwaManifest.fromFile(manifestPath);
  console.log(`   App: ${twaManifest.name} (${twaManifest.packageId})`);
  console.log(`   Version: ${twaManifest.appVersionName} (code: ${twaManifest.appVersionCode})\n`);

  // 2. Prepare output directory
  console.log(`2. Preparing output directory: ${absOutputDir}`);
  if (fs.existsSync(absOutputDir)) {
    fs.rmSync(absOutputDir, { recursive: true });
  }
  fs.mkdirSync(absOutputDir, { recursive: true });

  // 3. Generate Android project
  console.log('3. Generating Android project (this may take a minute)...');
  const log = new core.ConsoleLog('generate');
  const generator = new core.TwaGenerator();
  await generator.createTwaProject(absOutputDir, twaManifest, log);

  // Verify the project was generated
  const gradlew = path.join(absOutputDir, 'gradlew');
  if (fs.existsSync(gradlew)) {
    fs.chmodSync(gradlew, '755');
    console.log(`\n   Android project generated successfully in: ${absOutputDir}`);
    console.log('   Next: run ./gradlew assembleRelease bundleRelease');
  } else {
    console.error('\n   ERROR: gradlew not found — project generation may have failed');
    console.log('   Contents:', fs.readdirSync(absOutputDir));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\nProject generation failed:', err);
  process.exit(1);
});
