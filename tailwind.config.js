/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          50:  '#FBF7EC',
          100: '#F5EFD8',
          200: '#EBD9A4',
          300: '#D4AF5A',
          400: '#C49A35',
          500: '#B8962E',
          600: '#9A7B22',
          700: '#7A5C10',
          800: '#5C4208',
          900: '#3D2B05',
        },
        dark: {
          50:  '#F5F0EB',
          100: '#E8DDD0',
          200: '#C4B09A',
          300: '#9C8B72',
          400: '#6B5B45',
          500: '#3D3020',
          600: '#2C2318',
          700: '#1E1810',
          800: '#1A1410',
          900: '#0F0C08',
        },
        cream: {
          50:  '#FDFBF7',
          100: '#FAF6EE',
          200: '#F5EDE0',
          300: '#EDE2CF',
          400: '#E0D0B8',
          500: '#D0BB9A',
        }
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
