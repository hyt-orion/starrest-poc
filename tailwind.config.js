/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        calm: '#22c55e',
        watch: '#eab308',
        alert: '#f97316',
        act: '#ef4444',
      },
    },
  },
  plugins: [],
}
