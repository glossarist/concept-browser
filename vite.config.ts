import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cwd = process.cwd()

const isTest = process.env.VITEST !== undefined

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  root: __dirname,
  publicDir: resolve(cwd, 'public'),
  build: {
    outDir: resolve(cwd, 'dist'),
    emptyOutDir: true,
  },
  plugins: [vue()],
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
