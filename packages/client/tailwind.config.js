/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#060d06',
        surface: '#0a1a0a',
        border: '#1a3a1a',
        text: '#e2e8e2',
        accent: '#22c55e',
        damage: '#ef4444',
        energy: '#3b82f6',
        warning: '#eab308',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
