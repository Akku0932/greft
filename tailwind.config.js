/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF3E9',
          100: '#FFE2C7',
          200: '#FFC999',
          300: '#FFB06A',
          400: '#FF9640',
          500: '#FF7B17',
          600: '#DB5F0E',
          700: '#B7450A',
          800: '#933507',
          900: '#7A2A05'
        }
      },
      boxShadow: {
        soft: '0 10px 30px rgba(0,0,0,0.08)',
        'soft-dark': '0 10px 30px rgba(0,0,0,0.3)'
      }
    },
  },
  plugins: [],
}


