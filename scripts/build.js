#!/usr/bin/env node
/**
 * ResIQ Production Build Script
 *
 * Processes all JS files through:
 *   1. Terser — minification + strip console.log/warn/info
 *   2. javascript-obfuscator — makes code hard to read/copy
 *
 * Source files stay untouched. Minified output goes to dist/.
 * HTML files are copied to dist/ with script paths updated to dist/ versions.
 *
 * Usage:
 *   node scripts/build.js          # full build (minify + obfuscate)
 *   node scripts/build.js --fast   # minify only (skip obfuscation, for testing)
 */

const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const JavaScriptObfuscator = require('javascript-obfuscator');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// JS files to process (order doesn't matter for build — just need all of them)
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
        drop_console: false,     // We handle console selectively below
        pure_funcs: ['console.log', 'console.info', 'console.warn', 'console.debug'],
        passes: 2,
        dead_code: true,
        drop_debugger: true
    },
    mangle: {
        toplevel: false  // Don't mangle top-level names (they're shared across files)
    },
    format: {
        comments: false
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
    renameGlobals: false,       // Don't rename globals (shared across script tags)
    selfDefending: false,       // Can break in strict mode
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.5,
    transformObjectKeys: false,  // Don't break object key references
    unicodeEscapeSequence: false
};

const fastMode = process.argv.includes('--fast');

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

        // Step 2: Obfuscate (unless --fast)
        if (!fastMode && output.length > 50) {
            try {
                const obfResult = JavaScriptObfuscator.obfuscate(output, OBFUSCATOR_OPTIONS);
                output = obfResult.getObfuscatedCode();
            } catch (obfErr) {
                console.warn(`  OBFUSCATOR SKIP [${fileName}]: ${obfErr.message}`);
                // Fall back to just the minified version
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
    console.log(`\n🔨 ResIQ Production Build ${fastMode ? '(fast mode — no obfuscation)' : ''}\n`);

    // Clean dist
    if (fs.existsSync(DIST)) {
        fs.rmSync(DIST, { recursive: true });
    }
    fs.mkdirSync(DIST, { recursive: true });

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
            // Check it's a file, not a directory
            if (!fs.statSync(srcPath).isFile()) continue;
            const destPath = path.join(DIST, dir.dest, file);
            const ok = await processFile(srcPath, destPath);
            if (ok) processed++; else failed++;
        }
    }

    // Process root-level JS files
    console.log(`Processing root JS files`);
    for (const file of ROOT_JS_FILES) {
        const srcPath = path.join(ROOT, file);
        if (!fs.existsSync(srcPath)) continue;
        const destPath = path.join(DIST, file);
        const ok = await processFile(srcPath, destPath);
        if (ok) processed++; else failed++;
    }

    // Copy HTML files to dist with updated script paths
    console.log(`\nUpdating HTML files`);
    const htmlFiles = ['app.html', 'owner-portal.html', 'guest-portal.html'];
    for (const htmlFile of htmlFiles) {
        const srcPath = path.join(ROOT, htmlFile);
        if (!fs.existsSync(srcPath)) continue;

        let html = fs.readFileSync(srcPath, 'utf8');

        // Rewrite local script src paths to dist/ versions
        // e.g. src="js/config.js" → src="dist/js/config.js"
        // e.g. src="supabase-proxy.js" → src="dist/supabase-proxy.js"
        html = html.replace(
            /(<script\s+src=")((?:js\/|modules\/|views\/|supabase-proxy\.js|native-app-utils\.js|onboarding\.js|owner-portal-functions\.js))/g,
            '$1dist/$2'
        );

        fs.writeFileSync(path.join(DIST, htmlFile), html, 'utf8');
        console.log(`  ${htmlFile}: script paths updated → dist/${htmlFile}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Build complete: ${processed} files processed, ${failed} failed (${elapsed}s)\n`);

    if (failed > 0) process.exit(1);
}

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
