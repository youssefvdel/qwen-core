import { build } from 'esbuild';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

// Bundle TypeScript source into a single JS file
// - All node_modules are marked as external (installed by npm when users do npx -y qwen-core)
// - No tsx needed at runtime - just plain Node.js
// - Works on Windows, macOS, Linux identically
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/index.mjs',
  sourcemap: false,
  minify: false,
  // Keep all node_modules external - they get installed by npm
  external: [
    ...Object.keys(pkg.dependencies || {}),
    // Node built-ins
    'child_process', 'fs', 'fs/promises', 'path', 'url', 'util', 'os', 'stream', 'events',
    'crypto', 'http', 'https', 'net', 'tls', 'zlib', 'buffer', 'querystring',
  ],
  // Handle the package.json import
  define: {
    'import.meta.url': 'import.meta.url',
  },
  // Load package.json as JSON
  loader: {
    '.json': 'json',
  },
  // Banner to handle __dirname/__filename in ESM
  banner: {
    js: `
import { fileURLToPath as __fileURLToPath } from 'url';
import { dirname as __dirname } from 'path';
const __filename = __fileURLToPath(import.meta.url);
const __dirname_path = __dirname(__filename);
`,
  },
});

console.log('✅ Build complete: dist/index.mjs');
