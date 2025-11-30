/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      colors: {
        border: 'oklch(0.9 0.02 145)',
        input: 'oklch(0.95 0.01 145)',
        ring: 'oklch(0.7 0.08 145)',
        background: 'oklch(0.98 0.01 145)',
        foreground: 'oklch(0.2 0.02 145)',
        primary: {
          DEFAULT: 'oklch(65% 0.15 145)',
          foreground: 'oklch(0.15 0.02 145)',
        },
        secondary: {
          DEFAULT: 'oklch(45% 0.05 250)',
          foreground: 'oklch(0.98 0.01 250)',
        },
        muted: {
          DEFAULT: 'oklch(0.94 0.02 250)',
          foreground: 'oklch(0.35 0.03 250)',
        },
        card: {
          DEFAULT: 'oklch(0.99 0.01 145)',
          foreground: 'oklch(0.2 0.02 145)',
        },
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)',
      },
      boxShadow: {
        neo: '8px 8px 16px rgba(15, 23, 42, 0.12), -8px -8px 16px rgba(255, 255, 255, 0.9)',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
};