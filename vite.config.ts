import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cwd = process.cwd()

const isTest = process.env.VITEST !== undefined

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
          /<link[^>]*href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*"[^>]*>/,
          `<link href="${fontsUrl}" rel="stylesheet">`
        )
      }
      return result
    },
  }
}

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  root: __dirname,
  publicDir: resolve(cwd, 'public'),
  build: {
    outDir: resolve(cwd, 'dist'),
    emptyOutDir: true,
  },
  plugins: [yamlPlugin(), faviconPlugin(), brandingPlugin(), vue()],
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
  test: {
    environment: 'happy-dom',
    globals: true,
  },
})
