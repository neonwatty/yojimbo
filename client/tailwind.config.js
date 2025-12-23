/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        surface: {
          900: 'var(--surface-900)',
          800: 'var(--surface-800)',
          700: 'var(--surface-700)',
          600: 'var(--surface-600)',
          500: 'var(--surface-500)',
        },
        theme: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          dim: 'var(--text-dim)',
        },
        accent: {
          DEFAULT: '#f59e0b',
          bright: '#fbbf24',
          dim: '#d97706',
        },
        state: {
          working: '#06b6d4',
          awaiting: '#f59e0b',
          idle: '#6b7280',
          error: '#f43f5e',
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'reveal-up': 'reveal-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in': 'slide-in 0.3s ease-out forwards',
        'expand-in': 'expand-in 0.2s ease-out forwards',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'reveal-up': {
          from: { opacity: '0', transform: 'translateY(20px) scale(0.98)', filter: 'blur(4px)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)', filter: 'blur(0)' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'expand-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
