import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cwd = process.cwd()

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
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
})
