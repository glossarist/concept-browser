import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve, dirname, extname, join } from 'path'
import { readFileSync, existsSync, statSync, createReadStream } from 'fs'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cwd = process.cwd()

const isTest = process.env.VITEST !== undefined

const pkgVersion = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf8'),
).version

function yamlPlugin() {
  return {
    name: 'yaml-transform',
    transform(code: string, id: string) {
      if (!id.endsWith('.yml') && !id.endsWith('.yaml')) return
      const data = yaml.load(code)
      return { code: `export default ${JSON.stringify(data)}`, map: null }
    },
  }
}

function faviconPlugin() {
  return {
    name: 'favicon-inject',
    transformIndexHtml(html: string) {
      const tags = process.env.FAVICON_HTML
      if (!tags) return html
      const faviconTags = tags.split('\n').map((line: string) => {
        const m = line.trim().match(/<(\w+)\s+(.*)\/?>/s)
        if (!m) return null
        const tag = m[1]
        const attrs: Record<string, string> = {}
        for (const [, k, v] of m[2].matchAll(/(\w[\w-]*)="([^"]*)"/g)) {
          attrs[k] = v
        }
        return { tag, attrs, injectTo: 'head' as const }
      }).filter(Boolean)
      return { html, tags: faviconTags }
    },
  }
}

function inlineDataPlugin() {
  let publicDir: string | undefined
  const cache: Map<string, string> = new Map()
  return {
    name: 'inline-data',
    configResolved(config: any) {
      publicDir = config.publicDir
    },
    transformIndexHtml(html: string) {
      if (!publicDir) return html
      const tags: any[] = []
      for (const [id, path] of [
        ['datasets-json', 'datasets.json'],
        ['site-config-json', 'site-config.json'],
      ] as const) {
        try {
          let data = cache.get(path)
          if (!data) {
            data = readFileSync(resolve(publicDir!, path), 'utf-8')
            cache.set(path, data)
          }
          tags.push({
            tag: 'script',
            attrs: { type: 'application/json', id },
            children: data,
            injectTo: 'body' as const,
          })
        } catch { /* file may not exist during first build */ }
      }
      return { html, tags }
    },
  }
}

function brandingPlugin() {
  return {
    name: 'branding-inject',
    transformIndexHtml(html: string) {
      let result = html
      const title = process.env.SITE_TITLE
      if (title) {
        result = result.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      }
      const fontsUrl = process.env.SITE_FONTS_URL
      if (fontsUrl) {
        result = result.replace(
          /<link[^>]*href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*"[^>]*>(?:\s*<noscript>[^<]*<\/noscript>)?/,
          `<link rel="preload" as="style" href="${fontsUrl}" onload="this.rel='stylesheet'"><noscript><link href="${fontsUrl}" rel="stylesheet"></noscript>`
        )
      }
      return result
    },
  }
}

const dataDir = resolve(cwd, 'public/data')
const publicDir = resolve(cwd, 'public')

const mimeTypes: Record<string, string> = {
  '.json': 'application/json',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.ttl': 'text/turtle',
  '.jsonld': 'application/ld+json',
  '.tbx': 'application/xml',
}

// Serves /data/ files via middleware so the dev server doesn't need to watch
// the 15,000+ files in public/data/ (which causes fsevents to consume ~400% CPU).
function dataServePlugin(): Plugin {
  return {
    name: 'data-serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/data/')) return next()
        const filePath = join(dataDir, req.url.slice('/data/'.length))
        if (!filePath.startsWith(dataDir + '/') && filePath !== dataDir) return next()
        if (!existsSync(filePath)) return next()
        try {
          const stat = statSync(filePath)
          if (!stat.isFile()) return next()
          const ext = extname(filePath)
          res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream')
          res.setHeader('Content-Length', stat.size)
          createReadStream(filePath).pipe(res)
        } catch { next() }
      })
    },
  }
}

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  root: __dirname,
  publicDir,
  build: {
    outDir: resolve(cwd, 'dist'),
    emptyOutDir: true,
  },
  server: {
    watch: {
      ignored: [
        // concept-browser's own non-source dirs (121K+ files in dist/public)
        resolve(__dirname, 'dist') + '/**',
        resolve(__dirname, 'public') + '/**',
        resolve(__dirname, '.datasets') + '/**',
        resolve(__dirname, '.gcr') + '/**',
        resolve(__dirname, '.gcr-staging') + '/**',
        // oiml-vocab's data dir (15K+ files)
        resolve(cwd, 'public/data') + '/**',
      ],
    },
  },
  optimizeDeps: {
    exclude: ['@plurimath/plurimath'],
  },
  plugins: [tailwindcss(), yamlPlugin(), faviconPlugin(), brandingPlugin(), dataServePlugin(), inlineDataPlugin(), vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // Shim Node.js built-ins used by glossarist-js (not needed in browser, only for build)
      ...(!isTest ? {
        crypto: resolve(__dirname, 'src/shims/node-crypto.ts'),
        fs: resolve(__dirname, 'src/shims/empty.ts'),
        path: resolve(__dirname, 'src/shims/node-path.ts'),
      } : {}),
    },
  },
  define: {
    __CONCEPT_BROWSER_VERSION__: JSON.stringify(pkgVersion),
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: [
      'src/__tests__/**/*.test.ts',
      'scripts/__tests__/**/*.test.ts',
    ],
  },
})
