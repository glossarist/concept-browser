import { build } from 'esbuild';
import { globSync } from 'glob';
import { dirname, relative } from 'path';

const files = globSync('scripts/*.ts').filter(f => !f.includes('__tests__'));

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
