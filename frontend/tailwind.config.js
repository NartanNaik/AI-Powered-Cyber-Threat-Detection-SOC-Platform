/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom dark theme palette
        slate: {
          850: '#1e2640',
          900: '#0f172a',
          950: '#080d1a',
        },
        // Cyber security glows and statuses
        cyber: {
          green: '#10b981', // Normal/Benign
          yellow: '#fbbf24', // Medium
          orange: '#f97316', // High
          red: '#f43f5e', // Critical
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow-green': '0 0 15px rgba(16, 185, 129, 0.15)',
        'glow-yellow': '0 0 15px rgba(251, 191, 36, 0.15)',
        'glow-orange': '0 0 15px rgba(249, 115, 22, 0.15)',
        'glow-red': '0 0 15px rgba(244, 63, 94, 0.15)',
      }
    },
  },
  plugins: [],
}
