/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff',
          hover: '#dc2626'
        },
        secondary: {
          DEFAULT: '#64748b',
          foreground: '#ffffff',
          hover: '#475569'
        },
        success: {
          DEFAULT: '#10b981',
          foreground: '#ffffff',
          hover: '#059669'
        },
        border: '#e2e8f0',
        background: '#ffffff',
        foreground: '#1e293b',
        muted: {
          DEFAULT: '#f8fafc',
          foreground: '#64748b'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite'
      }
    },
  },
  plugins: [],
}