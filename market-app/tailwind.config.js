/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          900: '#0D0B61',
          800: '#112E81',
          700: '#133458',
          600: '#1a4a7a',
          500: '#1e5a9e',
          400: '#3b82d6',
          300: '#7baeec',
          200: '#bdd4f5',
          100: '#dce8fa',
          50: '#eef4fd',
        },
        accent: {
          500: '#eab308',
          400: '#FFF449',
          300: '#FFF78D',
          200: '#FEF2A0',
          100: '#fef9c3',
          50: '#fefce8',
        },
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
