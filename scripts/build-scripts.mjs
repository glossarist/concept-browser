import { build } from 'esbuild';
import { globSync } from 'glob';
import { relative } from 'path';

// Exclude scripts that are dev/CI-only and depend on devDependencies.
// These are not consumer-facing CLI commands and would pull in heavy deps
// (e.g. playwright for smoke) that consumers shouldn't need.
const DEV_ONLY = new Set([
  'scripts/smoke.ts',       // needs playwright (devDep, heavy)
]);

const files = globSync('scripts/*.ts').filter(f =>
  !f.includes('__tests__') && !DEV_ONLY.has(f),
);

await Promise.all(files.map(async (file) => {
  const outfile = file.replace(/\.ts$/, '.js');
  await build({
    entryPoints: [file],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    packages: 'external',
    sourcemap: false,
    logLevel: 'info',
  });
  console.log(`  ${relative(process.cwd(), file)} → ${relative(process.cwd(), outfile)}`);
}));

console.log(`\nCompiled ${files.length} scripts.`);
