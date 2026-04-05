#!/usr/bin/env node
/**
 * ResIQ Production Build Script
 *
 * Processes all JS files through:
 *   1. Terser — minification + strip console.log/warn/info
 *   2. javascript-obfuscator — makes code hard to read/copy
 *
 * Modes:
 *   --inplace    Overwrite source files (for Vercel deploy — builds from a copy)
 *   --fast       Minify only, skip obfuscation (for testing)
 *   (default)    Output to dist/ with updated HTML files
 *
 * Usage:
 *   node scripts/build.js              # full build → dist/
 *   node scripts/build.js --fast       # minify only → dist/
 *   node scripts/build.js --inplace    # full build, overwrite in-place (Vercel)
 */

const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// JS files to process
const JS_DIRS = [
    { src: 'js', dest: 'js' },
    { src: 'modules', dest: 'modules' },
    { src: 'modules/components', dest: 'modules/components' },
    { src: 'views', dest: 'views' }
];

const ROOT_JS_FILES = [
    'supabase-proxy.js',
    'native-app-utils.js',
    'onboarding.js',
    'owner-portal-functions.js',
    'sw.js',
    'guest-sw.js'
];

// Terser options — strips console.log/warn/info, keeps errors
const TERSER_OPTIONS = {
    compress: {
        drop_console: false,
        pure_funcs: ['console.log', 'console.info', 'console.warn', 'console.debug'],
        passes: 2,
        dead_code: true,
        drop_debugger: true
    },
    mangle: {
        toplevel: false
    },
    format: {
        comments: false,
        preamble: '/* (c) Hostsphere India Pvt Ltd. All rights reserved. */'
    }
};

// Obfuscator options — medium protection, balanced with performance
const OBFUSCATOR_OPTIONS = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.5,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.2,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    selfDefending: false,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.5,
    transformObjectKeys: false,
    unicodeEscapeSequence: false
};

const fastMode = process.argv.includes('--fast');
const inplaceMode = process.argv.includes('--inplace');

let JavaScriptObfuscator;
if (!fastMode) {
    try {
        JavaScriptObfuscator = require('javascript-obfuscator');
    } catch (e) {
        console.warn('javascript-obfuscator not found, falling back to minify-only');
    }
}

async function processFile(srcPath, destPath) {
    const code = fs.readFileSync(srcPath, 'utf8');
    const fileName = path.basename(srcPath);

    try {
        // Step 1: Terser — minify and strip console.log
        const terserResult = await minify(code, TERSER_OPTIONS);
        if (terserResult.error) {
            console.error(`  TERSER ERROR [${fileName}]:`, terserResult.error);
            return false;
        }

        let output = terserResult.code;

        // Step 2: Obfuscate (unless --fast or obfuscator unavailable)
        if (!fastMode && JavaScriptObfuscator && output.length > 50) {
            try {
                const obfResult = JavaScriptObfuscator.obfuscate(output, OBFUSCATOR_OPTIONS);
                output = obfResult.getObfuscatedCode();
            } catch (obfErr) {
                console.warn(`  OBFUSCATOR SKIP [${fileName}]: ${obfErr.message}`);
            }
        }

        // Ensure dest directory exists
        const destDir = path.dirname(destPath);
        fs.mkdirSync(destDir, { recursive: true });

        fs.writeFileSync(destPath, output, 'utf8');

        const originalSize = (code.length / 1024).toFixed(1);
        const newSize = (output.length / 1024).toFixed(1);
        const ratio = ((1 - output.length / code.length) * 100).toFixed(0);
        console.log(`  ${fileName}: ${originalSize}KB → ${newSize}KB (${ratio > 0 ? '-' : '+'}${Math.abs(ratio)}%)`);
        return true;
    } catch (err) {
        console.error(`  ERROR [${fileName}]:`, err.message);
        return false;
    }
}

async function build() {
    const startTime = Date.now();
    const modeLabel = inplaceMode ? 'in-place (Vercel)' : fastMode ? 'fast (no obfuscation)' : 'full';
    console.log(`\nResIQ Production Build [${modeLabel}]\n`);

    if (!inplaceMode) {
        // Clean dist
        if (fs.existsSync(DIST)) {
            fs.rmSync(DIST, { recursive: true });
        }
        fs.mkdirSync(DIST, { recursive: true });
    }

    let processed = 0;
    let failed = 0;

    // Process JS directories
    for (const dir of JS_DIRS) {
        const srcDir = path.join(ROOT, dir.src);
        if (!fs.existsSync(srcDir)) continue;

        const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js'));
        if (files.length === 0) continue;

        console.log(`Processing ${dir.src}/`);
        for (const file of files) {
            const srcPath = path.join(srcDir, file);
            if (!fs.statSync(srcPath).isFile()) continue;
            // In-place: overwrite source. Otherwise: write to dist/
            const destPath = inplaceMode ? srcPath : path.join(DIST, dir.dest, file);
            const ok = await processFile(srcPath, destPath);
            if (ok) processed++; else failed++;
        }
    }

    // Process root-level JS files
    console.log(`Processing root JS files`);
    for (const file of ROOT_JS_FILES) {
        const srcPath = path.join(ROOT, file);
        if (!fs.existsSync(srcPath)) continue;
        const destPath = inplaceMode ? srcPath : path.join(DIST, file);
        const ok = await processFile(srcPath, destPath);
        if (ok) processed++; else failed++;
    }

    // For dist mode: copy HTML files with updated script paths
    if (!inplaceMode) {
        console.log(`\nUpdating HTML files`);
        const htmlFiles = ['app.html', 'owner-portal.html', 'guest-portal.html'];
        for (const htmlFile of htmlFiles) {
            const srcPath = path.join(ROOT, htmlFile);
            if (!fs.existsSync(srcPath)) continue;

            let html = fs.readFileSync(srcPath, 'utf8');
            html = html.replace(
                /(<script\s+src=")((?:js\/|modules\/|views\/|supabase-proxy\.js|native-app-utils\.js|onboarding\.js|owner-portal-functions\.js))/g,
                '$1dist/$2'
            );

            fs.writeFileSync(path.join(DIST, htmlFile), html, 'utf8');
            console.log(`  ${htmlFile}: script paths updated`);
        }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nBuild complete: ${processed} files processed, ${failed} failed (${elapsed}s)\n`);

    if (failed > 0) process.exit(1);
}

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
