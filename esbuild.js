const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const isWatch = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production');

async function build() {
  // Ensure dist directory exists
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
  }

  // Extension Host bundle
  const extensionContext = await esbuild.context({
    entryPoints: ['src/extension/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: ['vscode', '@homebridge/node-pty-prebuilt-multiarch'],
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    sourcemap: !isProduction,
    minify: isProduction,
  });

  // Webview Browser bundle
  const webviewContext = await esbuild.context({
    entryPoints: ['src/webview/main.ts'],
    bundle: true,
    outfile: 'dist/webview.js',
    format: 'iife',
    platform: 'browser',
    target: 'chrome120',
    sourcemap: !isProduction,
    minify: isProduction,
  });

  // Copy or bundle CSS
  const cssContext = await esbuild.context({
    entryPoints: ['src/webview/style.css'],
    bundle: true,
    outfile: 'dist/webview.css',
    minify: isProduction,
  });

  if (isWatch) {
    console.log('[esbuild] Watching for changes...');
    await Promise.all([
      extensionContext.watch(),
      webviewContext.watch(),
      cssContext.watch(),
    ]);
  } else {
    await Promise.all([
      extensionContext.rebuild(),
      webviewContext.rebuild(),
      cssContext.rebuild(),
    ]);
    await Promise.all([
      extensionContext.dispose(),
      webviewContext.dispose(),
      cssContext.dispose(),
    ]);
    console.log('[esbuild] Build complete.');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
