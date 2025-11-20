/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{tsx,ts}', './node_modules/@literal-ui/core/**/*.js'],
  theme: {
    extend: {
      colors: {
        primary: '#19a1e6',
        'background-light': '#f6f7f8',
        'background-dark': '#111c21',
        'text-light': '#0e171b',
        'text-dark': '#e7eff3',
        'subtle-light': '#4e7f97',
        'subtle-dark': '#a0b8c3',
        'surface-light': '#ffffff',
        'surface-dark': '#1a282f',
        'border-light': '#e7eff3',
        'border-dark': '#2c3e47',
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        body: ['Georgia', 'serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        full: '9999px',
      },
    },
    container: {
      center: true,
      padding: '1rem',
    },
  },
  plugins: [require('@flow/tailwind'), require('@tailwindcss/line-clamp')],
}
