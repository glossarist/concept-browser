import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    resolve(__dirname, "index.html"),
    resolve(__dirname, "src/**/*.{vue,js,ts,jsx,tsx}"),
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['var(--font-header, "DM Serif Display")', 'Georgia', 'serif'],
        sans: ['var(--font-body, "DM Sans")', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink: {
          DEFAULT: '#1a1b2e',
          50: '#f0f0f4',
          100: '#dddde6',
          200: '#b8b9cc',
          300: '#8d8faa',
          400: '#636588',
          500: '#484a6e',
          600: '#36385a',
          700: '#2c2e4a',
          800: '#1a1b2e',
          900: '#0f1020',
        },
        surface: {
          DEFAULT: '#faf9f6',
          alt: '#f3f2ee',
          raised: '#ffffff',
        },
      },
      typography: {
        serif: {
          'font-family': 'var(--font-header, "DM Serif Display"), Georgia, serif',
        },
      },
    },
  },
  plugins: [],
}
