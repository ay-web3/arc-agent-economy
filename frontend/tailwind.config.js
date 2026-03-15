/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        arc: {
          dark: '#050505',
          neon: '#00ffaa',
          gray: '#1a1a1a',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
