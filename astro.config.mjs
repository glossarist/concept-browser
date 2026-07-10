import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import yaml from 'js-yaml';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'));
const pkgVersion = pkg.version;

const site = process.env.SITE_URL || 'https://www.geolexica.org';
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site,
  base,
  output: 'static',
  integrations: [
    vue({ appEntrypoint: '/src/islands/app-entry' }),
    sitemap(),
  ],
  i18n: {
    defaultLocale: 'eng',
    locales: ['eng', 'fra', 'deu', 'jpn', 'ara', 'zho', 'rus', 'spa', 'kor', 'swe', 'pol', 'fin', 'dan', 'nld', 'msa'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  vite: {
    plugins: [
      tailwindcss(),
      {
        name: 'yaml-transform',
        enforce: 'pre',
        transform(code, id) {
          if (!id.endsWith('.yml') && !id.endsWith('.yaml')) return;
          const data = yaml.load(code);
          return { code: `export default ${JSON.stringify(data)}`, map: null };
        },
      },
    ],
    define: {
      __CONCEPT_BROWSER_VERSION__: JSON.stringify(pkgVersion),
    },
  },
});
