/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#09090B',
        surface: {
          DEFAULT: '#121215',
          light: '#18181D',
          hover: '#1F1F24',
          border: 'rgba(255, 255, 255, 0.08)'
        },
        primary: {
          DEFAULT: '#10B981',
          hover: '#059669',
          glow: 'rgba(16, 185, 129, 0.25)'
        },
        warning: {
          DEFAULT: '#F59E0B',
          glow: 'rgba(245, 158, 11, 0.25)'
        },
        danger: {
          DEFAULT: '#EF4444',
          glow: 'rgba(239, 68, 68, 0.25)'
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      },
      animation: {
        'scan-line': 'scanLine 2.5s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite'
      },
      keyframes: {
        scanLine: {
          '0%': { transform: 'translateY(-100%)', opacity: '0.2' },
          '50%': { opacity: '0.8' },
          '100%': { transform: 'translateY(400%)', opacity: '0.2' }
        },
        glowPulse: {
          '0%, 100%': { opacity: '1', filter: 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.5))' },
          '50%': { opacity: '0.7', filter: 'drop-shadow(0 0 3px rgba(16, 185, 129, 0.2))' }
        }
      }
    },
  },
  plugins: [],
}
